import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveGithubCredentials } from '../../shared/resolveGithubCredentials.ts';

/**
 * FetchApiSourceContent
 * ---------------------
 * Standalone, ring-fenced function that fetches the parsed content of a
 * configured API source file by its section name.
 *
 * Usage:
 *   base44.functions.invoke('fetchApiSourceContent', { section: 'Actions' })
 *   base44.functions.invoke('fetchApiSourceContent', { section: 'Actions', include_raw: true })
 *
 * The function:
 *   1. Looks up the ApiSourceFile entity by section name (self-contained — caller
 *      only needs to know the section, not GitHub internals).
 *   2. Resolves GitHub credentials from GlobalConfig.
 *   3. Fetches the raw file content from GitHub.
 *   4. Parses it according to data_format (ttl, json, json-ld, yaml).
 *   5. Returns structured members with iri, label, definition.
 *
 * Can be called routinely/frequently from the KB API, other backend functions,
 * or the frontend — no side effects, no state mutations.
 */

// --- TTL parser (regex-based, tolerant of real-world Turtle) ---
function parseTtl(text, memberIdentifier) {
  const prefixes = {};
  const prefixRegex = /@prefix\s+([^:]+):\s+<([^>]+)>\s*\./g;
  let pmatch;
  while ((pmatch = prefixRegex.exec(text)) !== null) {
    prefixes[pmatch[1].trim()] = pmatch[2];
  }

  function resolve(term) {
    term = term.trim();
    if (term.startsWith('<') && term.endsWith('>')) return term.slice(1, -1);
    const colonIdx = term.indexOf(':');
    if (colonIdx > 0) {
      const prefix = term.substring(0, colonIdx);
      const local = term.substring(colonIdx + 1);
      if (prefixes[prefix]) return prefixes[prefix] + local;
    }
    return term;
  }

  let memberIri = memberIdentifier;
  if (memberIdentifier && memberIdentifier.includes(':') && !memberIdentifier.startsWith('<')) {
    memberIri = resolve(memberIdentifier);
  }

  const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
  const SKOS_PREF_LABEL = 'http://www.w3.org/2004/02/skos/core#prefLabel';
  const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';
  const SKOS_DEFINITION = 'http://www.w3.org/2004/02/skos/core#definition';

  const cleaned = text
    .replace(/#[^\n]*/g, '')
    .replace(/@prefix[^.]+\./g, '')
    .replace(/@base[^.]+\./g, '');

  const statements = [];
  let current = '';
  let inQuotes = false;
  let inAngles = false;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '"' && cleaned[i - 1] !== '\\') inQuotes = !inQuotes;
    if (!inQuotes && ch === '<') inAngles = true;
    if (!inQuotes && ch === '>') inAngles = false;
    current += ch;
    if (ch === '.' && !inQuotes && !inAngles) {
      statements.push(current.trim().replace(/\.$/, '').trim());
      current = '';
    }
  }
  if (current.trim()) statements.push(current.trim());

  const members = {};

  function extractTerm(str, keepRaw = false) {
    str = str.trim();
    if (str.startsWith('<') && str.endsWith('>')) return str.slice(1, -1);
    if (str.startsWith('"')) {
      let end = 1;
      while (end < str.length) {
        if (str[end] === '"' && str[end - 1] !== '\\') break;
        end++;
      }
      return str.substring(1, end);
    }
    return keepRaw ? str : resolve(str);
  }

  for (const stmt of statements) {
    if (!stmt) continue;
    const subjMatch = stmt.match(/^(\S+)\s+([\s\S]*)/);
    if (!subjMatch) continue;
    const subject = extractTerm(subjMatch[1], true);
    const rest = subjMatch[2].trim();

    const poPairs = [];
    let pair = '';
    inQuotes = false;
    for (let i = 0; i < rest.length; i++) {
      const ch = rest[i];
      if (ch === '"' && rest[i - 1] !== '\\') inQuotes = !inQuotes;
      if (ch === ';' && !inQuotes) { poPairs.push(pair.trim()); pair = ''; }
      else { pair += ch; }
    }
    if (pair.trim()) poPairs.push(pair.trim());

    // Flatten blank node subjects: when a statement uses [ ... ] syntax
    // (e.g. "subject [ a Type ; prop val ; ... ]"), strip the brackets
    // so the blank node's properties merge into the parent subject.
    if (poPairs.length > 0) {
      poPairs[0] = poPairs[0].replace(/^\s*\[\s*/, '');
      const lastIdx = poPairs.length - 1;
      poPairs[lastIdx] = poPairs[lastIdx].replace(/\s*\]\s*$/, '');
    }

    for (const po of poPairs) {
      if (!po || po.trim() === ']' || po.trim() === '[') continue;
      const poMatch = po.match(/^(\S+)\s+([\s\S]*)/);
      if (!poMatch) continue;
      const predicate = resolve(poMatch[1]);
      const objStr = poMatch[2].trim();
      const predResolved = poMatch[1].trim() === 'a' ? RDF_TYPE : predicate;

      const objs = [];
      let obj = '';
      inQuotes = false;
      for (let i = 0; i < objStr.length; i++) {
        const ch = objStr[i];
        if (ch === '"' && objStr[i - 1] !== '\\') inQuotes = !inQuotes;
        if (ch === ',' && !inQuotes) { objs.push(obj.trim()); obj = ''; }
        else { obj += ch; }
      }
      if (obj.trim()) objs.push(obj.trim());

      for (const o of objs) {
        if (!o) continue;
        const objValue = extractTerm(o);       // resolved — for type check & label/definition
        const objRaw = extractTerm(o, true);   // raw CURIE — for property storage & filtering
        const isLiteral = o.trim().startsWith('"');

        if (predResolved === RDF_TYPE && objValue === memberIri) {
          if (!members[subject]) members[subject] = { iri: subject, label: '', definition: '', properties: [] };
        }
        if (members[subject]) {
          members[subject].properties.push({ predicate: predResolved, object: objRaw, is_literal: isLiteral });
          if (predResolved === SKOS_PREF_LABEL && !members[subject].label) {
            members[subject].label = objValue;
          } else if (predResolved === RDFS_LABEL && !members[subject].label) {
            members[subject].label = objValue;
          } else if (predResolved === SKOS_DEFINITION) {
            members[subject].definition = objValue;
          }
        }
      }
    }
  }

  return { members: Object.values(members), memberIdentifierResolved: memberIri, prefixes };
}

// --- JSON / JSON-LD parser ---
function parseJsonContent(text, memberIdentifier) {
  const parsed = JSON.parse(text);
  let items = [];

  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
    items = parsed['@graph'];
  } else if (typeof parsed === 'object') {
    // Try common wrapper keys
    for (const key of ['items', 'members', 'concepts', 'values']) {
      if (Array.isArray(parsed[key])) { items = parsed[key]; break; }
    }
    if (items.length === 0) items = [parsed];
  }

  // Filter by @type if memberIdentifier is specified
  if (memberIdentifier) {
    const filtered = items.filter(item => {
      const types = item['@type'] || item['type'];
      if (Array.isArray(types)) return types.includes(memberIdentifier);
      return types === memberIdentifier;
    });
    if (filtered.length > 0) items = filtered;
  }

  const members = items.map(item => ({
    iri: item['@id'] || item['id'] || item['iri'] || '',
    label: item['prefLabel'] || item['label'] || item['name'] || item['skos:prefLabel'] || '',
    definition: item['definition'] || item['description'] || item['skos:definition'] || '',
    properties: item,
  }));

  return { members, memberIdentifierResolved: memberIdentifier };
}

// --- YAML parser (lightweight, using npm:yaml) ---
function parseYamlContent(text, memberIdentifier) {
  let YAML;
  try {
    YAML = require('npm:yaml@2.5.1');
  } catch {
    // Fallback: treat as raw text
    return { members: [], memberIdentifierResolved: memberIdentifier, parse_error: 'YAML parser unavailable' };
  }
  const parsed = YAML.parse(text);
  let items = [];
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (typeof parsed === 'object' && parsed) {
    for (const key of ['items', 'members', 'concepts', 'values']) {
      if (Array.isArray(parsed[key])) { items = parsed[key]; break; }
    }
    if (items.length === 0) items = [parsed];
  }

  if (memberIdentifier) {
    const filtered = items.filter(item => {
      const types = item.type || item['@type'];
      if (Array.isArray(types)) return types.includes(memberIdentifier);
      return types === memberIdentifier;
    });
    if (filtered.length > 0) items = filtered;
  }

  const members = items.map(item => ({
    iri: item.id || item.iri || item['@id'] || '',
    label: item.label || item.name || item.prefLabel || '',
    definition: item.definition || item.description || '',
    properties: item,
  }));

  return { members, memberIdentifierResolved: memberIdentifier };
}

// --- TTL serializer (from parsed members) ---
function escapeTtlLiteral(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function membersToTtl(members, memberIdentifierResolved, prefixes) {
  prefixes = prefixes || {};
  const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

  function iriToCurie(iri) {
    // Already a CURIE (e.g. "openrel:use", ":Action") — return as-is
    if (!iri.startsWith('http') && !iri.startsWith('www') && iri.includes(':')) {
      return iri;
    }
    for (const [prefix, ns] of Object.entries(prefixes)) {
      if (iri.startsWith(ns)) {
        return `${prefix}:${iri.substring(ns.length)}`;
      }
    }
    return `<${iri}>`;
  }

  // Collect all prefixes actually used (member IRIs + property predicates/objects)
  const usedPrefixes = new Set();
  function collectFromIri(iri) {
    const colonIdx = iri.indexOf(':');
    if (colonIdx > 0) {
      const prefix = iri.substring(0, colonIdx);
      if (prefixes[prefix]) usedPrefixes.add(prefix);
    }
    for (const [prefix, ns] of Object.entries(prefixes)) {
      if (iri.startsWith(ns)) { usedPrefixes.add(prefix); break; }
    }
  }

  for (const m of members) {
    if (m.iri) collectFromIri(m.iri);
    if (m.properties && Array.isArray(m.properties)) {
      for (const p of m.properties) {
        collectFromIri(p.predicate);
        if (!p.is_literal) collectFromIri(p.object);
      }
    }
    if (m.mappings) {
      for (const mp of m.mappings) {
        collectFromIri(mp.predicate);
        collectFromIri(mp.object);
      }
    }
  }

  // Resolve the member type IRI to a CURIE if possible
  let typeCurie = memberIdentifierResolved || 'skos:Concept';
  if (memberIdentifierResolved) {
    for (const [prefix, ns] of Object.entries(prefixes)) {
      if (memberIdentifierResolved.startsWith(ns)) {
        typeCurie = `${prefix}:${memberIdentifierResolved.substring(ns.length)}`;
        usedPrefixes.add(prefix);
        break;
      }
    }
  }

  const lines = [
    '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',
    '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
    '@prefix skos: <http://www.w3.org/2004/02/skos/core#> .',
  ];
  const hardcoded = new Set(['rdf', 'rdfs', 'skos']);
  for (const prefix of usedPrefixes) {
    if (!hardcoded.has(prefix)) {
      lines.push(`@prefix ${prefix}: <${prefixes[prefix]}> .`);
    }
  }
  lines.push('');

  for (const m of members) {
    const iri = m.iri || '';
    if (!iri) continue;

    if (m.properties && Array.isArray(m.properties) && m.properties.length > 0) {
      // Detail view: serialize all properties
      const parts = m.properties.map(p => {
        const predDisplay = p.predicate === RDF_TYPE ? 'a' : iriToCurie(p.predicate);
        const objDisplay = p.is_literal
          ? `"${escapeTtlLiteral(p.object)}"`
          : iriToCurie(p.object);
        return `    ${predDisplay} ${objDisplay}`;
      });
      lines.push(`${iri} ${parts.join(' ;\n')} .`);
    } else {
      // List view: type, label, definition, and mappings (if present)
      const parts = [`${iri} a ${typeCurie}`];
      if (m.label) parts.push(`    skos:prefLabel "${escapeTtlLiteral(m.label)}"`);
      if (m.definition) parts.push(`    skos:definition "${escapeTtlLiteral(m.definition)}"`);
      if (m.mappings) {
        for (const mp of m.mappings) {
          parts.push(`    ${mp.predicate} ${iriToCurie(mp.object)}`);
        }
      }
      lines.push(parts.join(' ;\n') + ' .');
    }
    lines.push('');
  }

  return lines.join('\n');
}

// --- Dynamic Mappings composer ---
// When the Mappings section is requested, content is composed dynamically
// from all active, non-system source files — not read from mappings.ttl.
// This ensures the Mappings API always reflects the current state of all
// source files without relying on the syncMappings automation having run.

const MAPPING_INVERSE = {
  'http://www.w3.org/2004/02/skos/core#exactMatch': 'http://www.w3.org/2004/02/skos/core#exactMatch',
  'http://www.w3.org/2004/02/skos/core#closeMatch': 'http://www.w3.org/2004/02/skos/core#closeMatch',
  'http://www.w3.org/2004/02/skos/core#broadMatch': 'http://www.w3.org/2004/02/skos/core#narrowMatch',
  'http://www.w3.org/2004/02/skos/core#narrowMatch': 'http://www.w3.org/2004/02/skos/core#broadMatch',
};

const SKOS_NS = 'http://www.w3.org/2004/02/skos/core#';

async function composeMappingsFromAllSources(base44, config) {
  const creds = await resolveGithubCredentials(base44, {
    repo: config?.github_repo,
    branch: config?.github_branch,
  });
  const token = creds.token;
  const githubRepo = creds.githubRepo;
  const branch = creds.branch;

  const allSources = await base44.asServiceRole.entities.ApiSourceFile.filter({ is_active: true });
  const sources = allSources.filter(s => !s.is_system);

  const members = {};
  const allPrefixes = {};

  for (const sf of sources) {
    if (!sf.file_path) continue;
    const apiUrl = `https://api.github.com/repos/${githubRepo}/contents/${sf.file_path}?ref=${branch}&_=${Date.now()}`;
    const resp = await fetch(apiUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3.raw',
        'User-Agent': 'OpenREL-App',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });
    if (!resp.ok) continue;
    const rawContent = await resp.text();

    let parsed;
    try {
      switch (sf.data_format || 'ttl') {
        case 'ttl':
          parsed = parseTtl(rawContent, sf.member_identifier || 'skos:Concept');
          break;
        case 'json':
        case 'json-ld':
          parsed = parseJsonContent(rawContent, sf.member_identifier);
          break;
        case 'yaml':
          parsed = parseYamlContent(rawContent, sf.member_identifier);
          break;
        default:
          continue;
      }
    } catch { continue; }
    if (!parsed || !parsed.members) continue;

    if (parsed.prefixes) Object.assign(allPrefixes, parsed.prefixes);

    // Extract mapping properties and invert them (external term → openrel term)
    for (const member of parsed.members) {
      if (!member.properties) continue;
      const openrelIri = member.iri;
      for (const prop of member.properties) {
        const inversePred = MAPPING_INVERSE[prop.predicate];
        if (!inversePred || prop.is_literal) continue;
        const externalTerm = prop.object;
        if (!members[externalTerm]) {
          members[externalTerm] = { iri: externalTerm, label: '', definition: '', properties: [] };
        }
        const exists = members[externalTerm].properties.some(
          p => p.predicate === inversePred && p.object === openrelIri
        );
        if (!exists) {
          members[externalTerm].properties.push({ predicate: inversePred, object: openrelIri, is_literal: false });
        }
      }
    }
  }

  return {
    members: Object.values(members),
    memberIdentifierResolved: SKOS_NS + 'Concept',
    prefixes: allPrefixes,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { section, source_file_id, include_raw = false, repo, branch = 'main', id, prefix, format = 'json', keep_properties = false } = body;

    if (!section && !source_file_id) {
      return Response.json({ error: 'section or source_file_id is required' }, { status: 400 });
    }

    // 1. Look up the ApiSourceFile entity
    let sourceFile;
    if (source_file_id) {
      sourceFile = await base44.asServiceRole.entities.ApiSourceFile.get(source_file_id);
    } else {
      const matches = await base44.asServiceRole.entities.ApiSourceFile.filter({ section });
      sourceFile = matches[0];
    }

    if (!sourceFile) {
      return Response.json({ error: `No API source file found for section "${section}"` }, { status: 404 });
    }

    if (!sourceFile.is_active) {
      return Response.json({ error: `Source file for section "${section}" is inactive` }, { status: 410 });
    }

    const { file_path, data_format = 'ttl', member_identifier = 'skos:Concept' } = sourceFile;

    // 2. Resolve GitHub credentials — checks GlobalConfig AND Project entities,
    //    using the most recently updated token (fixes stale-token issue when
    //    credentials were saved to a Project instead of GlobalConfig).
    const { token, githubRepo } = await resolveGithubCredentials(base44, { repo, branch });

    let parsed;
    let parseError = null;
    let rawContent = null;

    // Dynamic composition: the Mappings section aggregates mapping
    // properties from ALL active non-system source files at query time,
    // rather than reading from the pre-generated mappings.ttl file.
    if (sourceFile.is_system && sourceFile.section === 'Mappings') {
      parsed = await composeMappingsFromAllSources(base44, config);
    } else {
      if (!file_path) {
        return Response.json({ error: 'Source file has no file_path configured' }, { status: 400 });
      }

      // 3. Fetch the raw file — cache-busting timestamp ensures GitHub's
      //    CDN never serves a stale copy when the source file has been updated.
      const apiUrl = `https://api.github.com/repos/${githubRepo}/contents/${file_path}?ref=${branch}&_=${Date.now()}`;
      const resp = await fetch(apiUrl, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3.raw',
          'User-Agent': 'OpenREL-App',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      });
      if (!resp.ok) {
        const errText = await resp.text();
        return Response.json({ error: `GitHub ${resp.status}: ${errText.substring(0, 200)}` }, { status: resp.status });
      }

      rawContent = await resp.text();

      // 4. Parse according to data_format
      try {
        switch (data_format) {
          case 'ttl':
            parsed = parseTtl(rawContent, member_identifier);
            break;
          case 'json':
          case 'json-ld':
            parsed = parseJsonContent(rawContent, member_identifier);
            break;
          case 'yaml':
            parsed = parseYamlContent(rawContent, member_identifier);
            break;
          default:
            parsed = { members: [], memberIdentifierResolved: member_identifier };
            parseError = `Unsupported data_format: ${data_format}`;
        }
      } catch (e) {
        parsed = { members: [], memberIdentifierResolved: member_identifier };
        parseError = e.message;
      }
    }

    // Pipeline:
    //   1. Parse source → members only (non-members already stripped above)
    //   2. Apply parameter-based filters (id, prefix)
    //   3. Convert to requested format (ttl or json)
    //   4. Add wrappers / metadata

    let members = parsed.members;
    let appliedId = null;
    let appliedPrefix = null;

    // --- Step 2: Apply parameter-based filters ---

    // Detail filter: match by exact member IRI (CURIE or full IRI).
    if (id) {
      members = members.filter(m => m.iri === id);
      appliedId = id;
    }

    // List filter: narrow to members whose IRI starts with the prefix.
    if (prefix) {
      members = members.filter(m => String(m.iri).startsWith(prefix));
      appliedPrefix = prefix;
    }

    // For list views (no id), strip properties to keep payload small.
    // Detail views (with id) retain all properties.
    // Exception: the Mappings section includes match-related properties
    // (skos:exactMatch, closeMatch, broadMatch, narrowMatch) in the list
    // view, since that is the primary purpose of the mappings file.
    if (!id && !keep_properties) {
      const MAPPING_PREDICATES = new Set([
        'http://www.w3.org/2004/02/skos/core#exactMatch',
        'http://www.w3.org/2004/02/skos/core#closeMatch',
        'http://www.w3.org/2004/02/skos/core#broadMatch',
        'http://www.w3.org/2004/02/skos/core#narrowMatch',
      ]);

      if (sourceFile.section === 'Mappings') {
        members = members.map(({ iri, label, properties }) => ({
          iri,
          label,
          mappings: (properties || [])
            .filter(p => MAPPING_PREDICATES.has(p.predicate))
            .map(p => ({
              predicate: 'skos:' + p.predicate.substring(SKOS_NS.length),
              object: p.object,
            })),
        }));
      } else {
        members = members.map(({ iri, label, definition }) => ({ iri, label, definition }));
      }
    }

    const meta = {
      section: sourceFile.section,
      file_path,
      data_format,
      member_identifier,
      member_identifier_resolved: parsed.memberIdentifierResolved,
      member_count: members.length,
      requested_id: appliedId,
      applied_prefix: appliedPrefix,
    };

    // --- Step 3-4: Format conversion + wrappers ---

    if (format === 'ttl') {
      const ttlContent = membersToTtl(members, parsed.memberIdentifierResolved, parsed.prefixes);
      return Response.json({
        _content_type: 'text/turtle',
        _raw_body: ttlContent,
        _meta: meta,
      });
    }

    // Default: JSON
    const result = {
      status: 'success',
      ...meta,
      members,
    };

    if (parseError) result.parse_error = parseError;
    if (include_raw) result.raw_content = rawContent;
    if (keep_properties) result.prefixes = parsed.prefixes || {};

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});