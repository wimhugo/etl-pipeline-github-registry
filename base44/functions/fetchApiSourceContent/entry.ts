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

// Strip Turtle comments, leaving '#' alone when it sits inside an IRI (<...>)
// or a literal ("...").
function stripTurtleComments(text) {
  let out = '';
  let inString = false;
  let inAngle = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '"' && text[i - 1] !== '\\') inString = false;
      out += ch;
      continue;
    }
    if (inAngle) {
      if (ch === '>') inAngle = false;
      out += ch;
      continue;
    }
    if (ch === '"') { inString = true; out += ch; continue; }
    if (ch === '<') { inAngle = true; out += ch; continue; }
    if (ch === '#') {
      while (i + 1 < text.length && text[i + 1] !== '\n') i++;
      continue;
    }
    out += ch;
  }
  return out;
}

// --- TTL parser (regex-based, tolerant of real-world Turtle) ---
function parseTtl(text, memberIdentifier) {
  const prefixes = {};
  // A default prefix declaration (":") carries no name, so it is captured as
  // the empty string — files like the ODRL vocabulary use "@prefix : <...>"
  // next to their named prefixes.
  const prefixRegex = /@prefix\s+([A-Za-z0-9_.-]*):\s*<([^>]+)>\s*\./g;
  let pmatch;
  while ((pmatch = prefixRegex.exec(text)) !== null) {
    prefixes[pmatch[1]] = pmatch[2];
  }

  // Capture @base for folder-mode ID prefix substitution.
  const baseMatch = text.match(/@base\s+<([^>]+)>\s*\./);
  const baseIri = baseMatch ? baseMatch[1] : null;

  // A vocabulary may bind one namespace twice (the ODRL file declares both
  // ":" and "odrl:"). Terms written with the default prefix are surfaced with
  // the named prefix so returned identifiers stay self-describing.
  const defaultNs = prefixes[''];
  const defaultAlias = defaultNs
    ? Object.keys(prefixes).find((p) => p && prefixes[p] === defaultNs)
    : null;

  function withDefaultAlias(term) {
    if (!defaultAlias || !term.startsWith(':') || term.startsWith('::')) return term;
    return defaultAlias + term;
  }

  function resolve(term) {
    term = term.trim();
    if (term.startsWith('<') && term.endsWith('>')) return term.slice(1, -1);
    const colonIdx = term.indexOf(':');
    // colonIdx === 0 means a default-prefix term such as ":Action".
    if (colonIdx >= 0) {
      const prefix = term.substring(0, colonIdx);
      const local = term.substring(colonIdx + 1);
      if (prefixes[prefix]) return prefixes[prefix] + local;
    }
    return term;
  }

  // member_identifier may list several types (comma-separated), e.g.
  // "rdfs:Class,owl:Class" — a subject is a member when it matches any of them.
  const allSubjectsMode = !memberIdentifier;
  const memberIris = new Set();
  for (const part of String(memberIdentifier || '').split(',')) {
    const term = part.trim();
    if (!term) continue;
    memberIris.add(term.includes(':') && !term.startsWith('<') ? resolve(term) : term);
  }
  const memberIri = [...memberIris].join(', ');

  const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
  const SKOS_PREF_LABEL = 'http://www.w3.org/2004/02/skos/core#prefLabel';
  const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';
  const SKOS_DEFINITION = 'http://www.w3.org/2004/02/skos/core#definition';

  const cleaned = stripTurtleComments(text)
    .replace(/@prefix[^\n]*/g, '')
    .replace(/@base[^\n]*/g, '');

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
    // A '.' is a statement terminator only when followed by whitespace or EOF,
    // so decimals/version strings inside CURIEs (e.g. spdx:CC0-1.0) don't split.
    const nextCh = cleaned[i + 1];
    if (ch === '.' && !inQuotes && !inAngles && (nextCh === undefined || /\s/.test(nextCh))) {
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
    const subject = withDefaultAlias(extractTerm(subjMatch[1], true));
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
        const objRaw = withDefaultAlias(extractTerm(o, true));   // raw CURIE — for property storage & filtering
        const isLiteral = o.trim().startsWith('"');

        if (predResolved === RDF_TYPE && memberIris.has(objValue)) {
          if (!members[subject]) members[subject] = { iri: subject, label: '', definition: '', properties: [] };
        }
        // Folder mode: every subject is a member.
        if (allSubjectsMode && !members[subject]) {
          members[subject] = { iri: subject, label: '', definition: '', properties: [] };
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

  return { members: Object.values(members), memberIdentifierResolved: memberIri, prefixes, baseIri };
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
    iri: item['@id'] || item['id'] || item['iri'] || item['openrel_IRI'] || item['uri'] || '',
    label: item['prefLabel'] || item['label'] || item['name'] || item['title'] || item['skos:prefLabel'] || '',
    definition: item['definition'] || item['description'] || item['skos:definition'] || '',
    url: item['url'] || item['link'] || item['href'] || '',
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
      // The default prefix is skipped: a namespace bound twice is emitted with
      // its named prefix, which keeps CURIEs readable.
      if (prefix && iri.startsWith(ns)) {
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
      if (!prefix) continue;
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
  // A source may list several member types; the 'a' shorthand carries one.
  // Only the first listed type is emitted, since the 'a' shorthand carries one.
  const firstMemberType = (memberIdentifierResolved || 'skos:Concept').split(',')[0].trim();
  let typeCurie = firstMemberType;
  for (const [prefix, ns] of Object.entries(prefixes)) {
    if (prefix && firstMemberType.startsWith(ns)) {
      typeCurie = `${prefix}:${firstMemberType.substring(ns.length)}`;
      usedPrefixes.add(prefix);
      break;
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

// --- JSON-LD serializer (from parsed members) ---
const JSONLD_RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const JSONLD_RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#';
const JSONLD_SKOS_NS = 'http://www.w3.org/2004/02/skos/core#';

function toCompact(iri, prefixes) {
  if (!iri || typeof iri !== 'string') return iri;
  // Already a CURIE — leave as is.
  if (!/^https?:\/\//.test(iri)) return iri;
  for (const [prefix, ns] of Object.entries(prefixes || {})) {
    // An empty prefix is not a legal JSON-LD term, so the named prefix bound to
    // the same namespace is used instead.
    if (!prefix) continue;
    if (ns && iri.startsWith(ns)) return `${prefix}:${iri.substring(ns.length)}`;
  }
  return iri;
}

function membersToJsonLd(members, memberIdentifierResolved, prefixes) {
  const RDF_TYPE = JSONLD_RDF_NS + 'type';

  const nodes = (members || []).map((m) => {
    const props = Array.isArray(m.properties) ? m.properties : [];
    const node = { '@id': m.iri };

    const types = props
      .filter((p) => p.predicate === RDF_TYPE)
      .map((p) => toCompact(p.object, prefixes));
    if (types.length === 0 && memberIdentifierResolved) {
      types.push(toCompact(String(memberIdentifierResolved).split(',')[0].trim(), prefixes));
    }
    if (types.length) node['@type'] = types.length === 1 ? types[0] : types;

    if (m.label) node['skos:prefLabel'] = m.label;
    if (m.definition) node['skos:definition'] = m.definition;

    for (const p of props) {
      if (p.predicate === RDF_TYPE) continue;
      const key = toCompact(p.predicate, prefixes);
      if (key === 'skos:prefLabel' || key === 'skos:definition') continue;
      const value = p.is_literal ? p.object : { '@id': toCompact(p.object, prefixes) };
      if (node[key] === undefined) node[key] = value;
      else if (Array.isArray(node[key])) node[key].push(value);
      else node[key] = [node[key], value];
    }

    // Mapping lists (Mappings section) carry match predicates instead of a
    // full property set — keep them in the JSON-LD node too.
    for (const mp of m.mappings || []) {
      if (!mp?.predicate) continue;
      const value = { '@id': toCompact(mp.object, prefixes) };
      if (node[mp.predicate] === undefined) node[mp.predicate] = value;
      else if (Array.isArray(node[mp.predicate])) node[mp.predicate].push(value);
      else node[mp.predicate] = [node[mp.predicate], value];
    }

    return node;
  });

  const context = { rdf: JSONLD_RDF_NS, rdfs: JSONLD_RDFS_NS, skos: JSONLD_SKOS_NS };
  for (const [prefix, ns] of Object.entries(prefixes || {})) {
    if (!prefix) continue;
    if (!context[prefix] && ns) context[prefix] = ns;
  }

  return { '@context': context, '@graph': nodes };
}

// Wraps a JSON-LD document in the same envelope the TTL branch uses, so the
// proxy and the UI can reconstruct the response with its proper content type.
function jsonLdResponse(members, memberIdentifierResolved, prefixes, meta) {
  return Response.json({
    _content_type: 'application/ld+json',
    _raw_body: JSON.stringify(membersToJsonLd(members, memberIdentifierResolved, prefixes), null, 2),
    _meta: meta,
  });
}

// --- Folder mode: list TTL files in a folder, each file is a member ---
//
// In folder mode, file_path points to a GitHub folder. Each .ttl file inside
// is one member. The list view returns { iri, label, definition } where:
//   - iri  = the file's primary subject IRI, with @base substituted by id_prefix
//            (e.g. openrel:01-public-domain) when id_prefix is set, else the
//            full resolved subject IRI.
//   - label/definition = the title_field / description_field values from that
//            subject (configurable CURIEs, defaults dct:title / dct:description).
// The detail view (id param) returns the entire raw TTL file (format=ttl) or
// the parsed single-subject properties (format=json, keep_properties).

function resolveCurie(curie, prefixes) {
  if (!curie) return null;
  curie = curie.trim();
  if (curie.startsWith('<') && curie.endsWith('>')) return curie.slice(1, -1);
  const colonIdx = curie.indexOf(':');
  if (colonIdx > 0) {
    const prefix = curie.substring(0, colonIdx);
    const local = curie.substring(colonIdx + 1);
    if (prefixes[prefix]) return prefixes[prefix] + local;
  }
  return curie; // already an IRI or unknown prefix — return as-is
}

function findPrimarySubject(parsed, titleFieldIri, descriptionFieldIri) {
  // Prefer a subject that carries the title or description field; otherwise
  // fall back to the first subject in document order.
  const members = parsed.members || [];
  if (members.length === 0) return null;
  const withField = members.find(m =>
    (m.properties || []).some(p =>
      p.predicate === titleFieldIri || p.predicate === descriptionFieldIri
    )
  );
  return withField || members[0];
}

function applyIdPrefix(subjectIri, idPrefix, prefixes, baseIri) {
  if (!idPrefix) return subjectIri;
  // Replace the resolved @base portion with the configured prefix.
  // idPrefix is a CURIE-style string like 'openrel:'.
  if (baseIri && subjectIri.startsWith(baseIri)) {
    return idPrefix + subjectIri.substring(baseIri.length);
  }
  return subjectIri;
}

async function listFolderFiles(base44, config, folderPath) {
  const creds = await resolveGithubCredentials(base44, {
    repo: config?.github_repo,
    branch: config?.github_branch,
  });
  const token = creds.token;
  const githubRepo = creds.githubRepo;
  const branch = creds.branch;

  const apiUrl = `https://api.github.com/repos/${githubRepo}/contents/${folderPath}?ref=${branch}&_=${Date.now()}`;
  const resp = await fetch(apiUrl, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'OpenREL-App',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    }
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`GitHub ${resp.status}: ${errText.substring(0, 200)}`);
  }
  const listing = await resp.json();
  if (!Array.isArray(listing)) return { files: [], token, githubRepo, branch };
  // Only top-level .ttl files (folder mode does not recurse).
  const files = listing
    .filter(item => item.type === 'file' && item.name.endsWith('.ttl'))
    .map(item => item.path);
  return { files, token, githubRepo, branch };
}

async function fetchFolderMembers(base44, config, sourceFile) {
  const folderPath = sourceFile.file_path;
  const { files, token, githubRepo, branch } = await listFolderFiles(base44, config, folderPath);

  const titleField = sourceFile.title_field || 'dct:title';
  const descriptionField = sourceFile.description_field || 'dct:description';
  const idPrefix = sourceFile.id_prefix || '';

  const members = [];
  const fileById = {}; // id -> { rawContent, parsed, subject }

  for (const filePath of files) {
    const rawUrl = `https://api.github.com/repos/${githubRepo}/contents/${filePath}?ref=${branch}&_=${Date.now()}`;
    const resp = await fetch(rawUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3.raw',
        'User-Agent': 'OpenREL-App',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });
    if (!resp.ok) continue;
    const rawContent = await resp.text();

    // null memberIdentifier → all-subjects mode (every subject becomes a member)
    const parsed = parseTtl(rawContent, null);
    const prefixes = parsed.prefixes || {};

    // Resolve title/description field CURIEs to full IRIs using this file's prefixes.
    const titleFieldIri = resolveCurie(titleField, prefixes) || titleField;
    const descriptionFieldIri = resolveCurie(descriptionField, prefixes) || descriptionField;

    const subject = findPrimarySubject(parsed, titleFieldIri, descriptionFieldIri);
    if (!subject) continue;

    const subjectIri = subject.iri;
    const baseIri = parsed.baseIri || null;

    let id;
    if (idPrefix) {
      // If subject is relative (no scheme), prefix directly.
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(subjectIri) && !subjectIri.startsWith(idPrefix)) {
        id = applyIdPrefix(subjectIri, idPrefix, prefixes, baseIri);
      } else {
        // Relative subject — just prepend the prefix.
        id = idPrefix + subjectIri;
      }
    } else {
      // No prefix configured — return the full subject IRI (resolved against @base if relative).
      id = baseIri && !subjectIri.startsWith('http') && !subjectIri.startsWith('urn')
        ? baseIri + subjectIri
        : subjectIri;
    }

    const label = (subject.properties || []).find(p => p.predicate === titleFieldIri)?.object || subject.label || '';
    // Labels come back as quoted literals — strip surrounding quotes if present.
    const cleanLabel = String(label).replace(/^"|"$/g, '').replace(/^"|"$/g, '');
    const desc = (subject.properties || []).find(p => p.predicate === descriptionFieldIri)?.object || subject.definition || '';
    const cleanDesc = String(desc).replace(/^"|"$/g, '').replace(/^"|"$/g, '');

    members.push({
      iri: id,
      label: cleanLabel,
      definition: cleanDesc,
    });

    fileById[id] = { rawContent, parsed, subject, filePath };
  }

  return { members, fileById, prefixes: {} };
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
const OPENREL_NS = 'http://www.w3.org/ns/openrel/0/';
const EVALUATION_MAPPING_IRI = OPENREL_NS + 'EvaluationMapping';

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
      // Non-TTL sources carry the raw record as `properties` rather than a
      // predicate list — only array-shaped properties can be scanned here.
      if (!Array.isArray(member.properties)) continue;
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

    // ---- Folder mode: each TTL file in the folder is a member ----
    if (sourceFile.source_mode === 'folder') {
      const { members, fileById } = await fetchFolderMembers(base44, { github_repo: repo, github_branch: branch }, sourceFile);

      let appliedId = null;
      let appliedPrefix = null;
      let detailMembers = members;

      if (id) {
        detailMembers = members.filter(m => m.iri === id);
        appliedId = id;
      }
      if (prefix) {
        detailMembers = detailMembers.filter(m => String(m.iri).startsWith(prefix));
        appliedPrefix = prefix;
      }

      const meta = {
        section: sourceFile.section,
        file_path: sourceFile.file_path,
        source_mode: 'folder',
        member_count: detailMembers.length,
        requested_id: appliedId,
        applied_prefix: appliedPrefix,
      };

      // Detail view: return the entire raw file.
      if (id) {
        const matched = detailMembers[0];
        const fileEntry = matched ? fileById[matched.iri] : null;

        if (!fileEntry) {
          return Response.json({ ...meta, status: 'not_found', members: [] }, { status: 404 });
        }

        if (format === 'ttl') {
          return Response.json({
            _content_type: 'text/turtle',
            _raw_body: fileEntry.rawContent,
            _meta: meta,
          });
        }
        // format=json-ld: JSON-LD document for the single member
        const subj = fileEntry.subject;
        if (format === 'json-ld') {
          return jsonLdResponse(
            [{ iri: matched.iri, label: matched.label, definition: matched.definition, properties: subj.properties || [] }],
            null,
            fileEntry.parsed.prefixes || {},
            meta,
          );
        }
        // format=json: return parsed single-subject properties (keep_properties path)
        return Response.json({
          status: 'success',
          ...meta,
          members: [{
            iri: matched.iri,
            label: matched.label,
            definition: matched.definition,
            properties: subj.properties || [],
          }],
          prefixes: fileEntry.parsed.prefixes || {},
          raw_content: include_raw ? fileEntry.rawContent : undefined,
        });
      }

      // List view
      if (format === 'ttl') {
        const ttlContent = membersToTtl(detailMembers, null, {});
        return Response.json({
          _content_type: 'text/turtle',
          _raw_body: ttlContent,
          _meta: meta,
        });
      }
      if (format === 'json-ld') {
        return jsonLdResponse(detailMembers, null, {}, meta);
      }
      return Response.json({ status: 'success', ...meta, members: detailMembers });
    }

    const { file_path, data_format = 'ttl', member_identifier = 'skos:Concept' } = sourceFile;

    // file_path may list several repository files (newline- or comma-separated).
    // Members from every listed file are merged into one member list.
    const filePaths = String(file_path || '')
      .split(/[\n,]+/)
      .map((p) => p.trim())
      .filter(Boolean);

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
      parsed = await composeMappingsFromAllSources(base44, { github_repo: repo, github_branch: branch });
    } else {
      if (!filePaths.length) {
        return Response.json({ error: 'Source file has no file_path configured' }, { status: 400 });
      }

      const combined = { members: [], memberIdentifierResolved: null, prefixes: {} };
      const rawByPath = {};

      for (const path of filePaths) {
        // 3. Fetch the raw file — cache-busting timestamp ensures GitHub's
        //    CDN never serves a stale copy when the source file has been updated.
        const apiUrl = `https://api.github.com/repos/${githubRepo}/contents/${path}?ref=${branch}&_=${Date.now()}`;
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
          return Response.json({ error: `GitHub ${resp.status} (${path}): ${errText.substring(0, 200)}` }, { status: resp.status });
        }

        const text = await resp.text();
        rawByPath[path] = text;

        // 4. Parse according to data_format
        let fileParsed;
        try {
          switch (data_format) {
            case 'ttl':
              fileParsed = parseTtl(text, member_identifier);
              break;
            case 'json':
            case 'json-ld':
              fileParsed = parseJsonContent(text, member_identifier);
              break;
            case 'yaml':
              fileParsed = parseYamlContent(text, member_identifier);
              break;
            default:
              fileParsed = { members: [], memberIdentifierResolved: member_identifier };
              parseError = `Unsupported data_format: ${data_format}`;
          }
        } catch (e) {
          fileParsed = { members: [], memberIdentifierResolved: member_identifier };
          parseError = e.message;
        }

        if (fileParsed.prefixes) Object.assign(combined.prefixes, fileParsed.prefixes);
        if (!combined.memberIdentifierResolved) {
          combined.memberIdentifierResolved = fileParsed.memberIdentifierResolved;
        }
        combined.members.push(...(fileParsed.members || []));
      }

      // A member present in more than one listed file appears once.
      parsed = {
        ...combined,
        members: [...new Map(combined.members.map((m) => [m.iri, m])).values()],
      };
      rawContent = filePaths.length === 1 ? rawByPath[filePaths[0]] : rawByPath;
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

      // Reasoner evaluation mappings (openrel:EvaluationMapping individuals):
      // report the compared individual/subject pair with its evaluation outcome,
      // and keep every other predicate (evaluationClass, derivationType,
      // sourceRelation, wasDerivedFrom, rationale, subject/objectRole, support)
      // since those drive filtering.
      if (parsed.memberIdentifierResolved === EVALUATION_MAPPING_IRI) {
        members = members.map(({ iri, properties = [] }) => {
          const value = (name) => {
            const found = properties.find((p) => p.predicate === OPENREL_NS + name);
            return found ? found.object : null;
          };
          return {
            iri,
            compared_individual: value('comparedIndividual'),
            compared_subject: value('comparedSubject'),
            evaluation_outcome: value('evaluationOutcome'),
            evaluation_class: value('evaluationClass'),
            derivation_type: value('derivationType'),
            source_relation: value('sourceRelation'),
            derived_from: value('wasDerivedFrom'),
            properties,
          };
        });
      } else if (sourceFile.section === 'Mappings') {
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
        members = members.map(({ iri, label, definition, url }) => (
          url ? { iri, label, definition, url } : { iri, label, definition }
        ));
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

    if (format === 'json-ld') {
      return jsonLdResponse(members, parsed.memberIdentifierResolved, parsed.prefixes, meta);
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