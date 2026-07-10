import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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
      statements.push(current.trim());
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

    for (const po of poPairs) {
      if (!po) continue;
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
        const objValue = extractTerm(o);

        if (predResolved === RDF_TYPE && objValue === memberIri) {
          if (!members[subject]) members[subject] = { iri: subject, label: '', definition: '' };
        }
        if (members[subject]) {
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

  return { members: Object.values(members), memberIdentifierResolved: memberIri };
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
  }));

  return { members, memberIdentifierResolved: memberIdentifier };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { section, source_file_id, include_raw = false, repo, branch = 'main', id, prefix } = body;

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

    if (!file_path) {
      return Response.json({ error: 'Source file has no file_path configured' }, { status: 400 });
    }

    // 2. Resolve GitHub credentials
    const configs = await base44.asServiceRole.entities.GlobalConfig.list();
    const config = configs[0] || {};
    const token = config.github_token || Deno.env.get('GITHUB_TOKEN');
    const githubRepo = repo || config.github_repo || 'wimhugo/openrel';

    // 3. Fetch the raw file
    const apiUrl = `https://api.github.com/repos/${githubRepo}/contents/${file_path}?ref=${branch}`;
    const resp = await fetch(apiUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3.raw',
        'User-Agent': 'OpenREL-App',
      }
    });
    if (!resp.ok) {
      const errText = await resp.text();
      return Response.json({ error: `GitHub ${resp.status}: ${errText.substring(0, 200)}` }, { status: resp.status });
    }

    const rawContent = await resp.text();

    // 4. Parse according to data_format
    let parsed;
    let parseError = null;
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

    // 5. Return structured result
    const result = {
      status: 'success',
      section: sourceFile.section,
      file_path,
      data_format,
      member_identifier,
      member_identifier_resolved: parsed.memberIdentifierResolved,
      member_count: parsed.members.length,
      members: parsed.members,
    };

    if (parseError) result.parse_error = parseError;
    if (include_raw) result.raw_content = rawContent;

    // If an id path parameter was provided (detail endpoint), filter to the
    // single matching member.  The id may be a prefixed term (e.g. "odrl:move")
    // or a full IRI (e.g. "http://www.w3.org/ns/odrl/2/move").  We compare on
    // the local name (the fragment after the last ':', '/', or '#') as a
    // fallback so that prefix differences don't prevent a match.
    if (id) {
      const localName = (term) => {
        const t = String(term);
        const idx = Math.max(t.lastIndexOf(':'), t.lastIndexOf('/'), t.lastIndexOf('#'));
        return idx >= 0 ? t.substring(idx + 1) : t;
      };
      const idLocal = localName(id);
      result.members = result.members.filter(m =>
        m.iri === id ||
        localName(m.iri) === idLocal
      );
      result.member_count = result.members.length;
      result.requested_id = id;
    }

    // If a prefix query parameter was provided (list endpoint), filter to
    // members whose IRI starts with the given prefix (e.g. "openrel:").
    if (prefix) {
      result.members = result.members.filter(m =>
        String(m.iri).startsWith(prefix)
      );
      result.member_count = result.members.length;
      result.applied_prefix = prefix;
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});