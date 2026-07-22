import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveGithubCredentials } from '../../shared/resolveGithubCredentials.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { file_path, member_identifier = 'skos:Concept', repo, branch = 'main' } = body;

    if (!file_path) return Response.json({ error: 'file_path is required' }, { status: 400 });

    // Resolve GitHub credentials — checks GlobalConfig AND Project entities
    const { token, githubRepo } = await resolveGithubCredentials(base44, { repo, branch });

    // Fetch the raw file — cache-busting timestamp ensures freshness
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

    const text = await resp.text();

    // --- Regex-based TTL parser (tolerant of real-world Turtle) ---

    // 1. Extract @prefix declarations
    const prefixes = {};
    const prefixRegex = /@prefix\s+([^:]+):\s+<([^>]+)>\s*\./g;
    let pmatch;
    while ((pmatch = prefixRegex.exec(text)) !== null) {
      prefixes[pmatch[1].trim()] = pmatch[2];
    }

    // Also handle @base
    const baseMatch = text.match(/@base\s+<([^>]+)>\s*\./);
    const baseIri = baseMatch ? baseMatch[1] : '';

    // Resolve a prefixed name or full IRI to a full IRI
    function resolve(term) {
      term = term.trim();
      if (term.startsWith('<') && term.endsWith('>')) {
        return term.slice(1, -1);
      }
      const colonIdx = term.indexOf(':');
      if (colonIdx > 0) {
        const prefix = term.substring(0, colonIdx);
        const local = term.substring(colonIdx + 1);
        if (prefixes[prefix]) {
          return prefixes[prefix] + local;
        }
      }
      return term;
    }

    // 2. Resolve member_identifier to full IRI
    let memberIri = member_identifier;
    if (member_identifier.includes(':') && !member_identifier.startsWith('<')) {
      memberIri = resolve(member_identifier);
    }

    const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    const SKOS_PREF_LABEL = 'http://www.w3.org/2004/02/skos/core#prefLabel';
    const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';
    const SKOS_DEFINITION = 'http://www.w3.org/2004/02/skos/core#definition';

    // 3. Split into statements (terminated by '.')
    // Remove comments and prefix declarations first
    const cleaned = text
      .replace(/#[^\n]*/g, '')        // remove comments
      .replace(/@prefix[^.]+\./g, '')  // remove prefix declarations
      .replace(/@base[^.]+\./g, '');   // remove base declarations

    // Split on '.' that are not inside quotes or angle brackets
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

    // 4. Parse each statement to extract subject + predicate-object pairs
    const members = {};

    function extractTerm(str, keepRaw = false) {
      str = str.trim();
      if (str.startsWith('<') && str.endsWith('>')) return str.slice(1, -1);
      if (str.startsWith('"')) {
        // Handle multi-line strings and language tags
        let end = 1;
        while (end < str.length) {
          if (str[end] === '"' && str[end - 1] !== '\\') break;
          end++;
        }
        return str.substring(1, end);
      }
      // Prefixed name
      return keepRaw ? str : resolve(str);
    }

    for (const stmt of statements) {
      if (!stmt) continue;
      // Split into subject and rest (subject is the first term, followed by predicate-object pairs)
      // Subjects can be <iri>, prefixed:name, or _:blanknode
      // Predicate-object pairs are separated by ';'
      // Multiple objects are separated by ','

      // Find the subject (first term before whitespace)
      const subjMatch = stmt.match(/^(\S+)\s+([\s\S]*)/);
      if (!subjMatch) continue;
      const subject = extractTerm(subjMatch[1], true);
      const rest = subjMatch[2].trim();

      // Split predicate-object pairs by ';' (not in quotes)
      const poPairs = [];
      let pair = '';
      inQuotes = false;
      for (let i = 0; i < rest.length; i++) {
        const ch = rest[i];
        if (ch === '"' && rest[i - 1] !== '\\') inQuotes = !inQuotes;
        if (ch === ';' && !inQuotes) {
          poPairs.push(pair.trim());
          pair = '';
        } else {
          pair += ch;
        }
      }
      if (pair.trim()) poPairs.push(pair.trim());

      for (const po of poPairs) {
        if (!po) continue;
        // Split predicate and objects
        // Predicate is the first term, objects follow
        const poMatch = po.match(/^(\S+)\s+([\s\S]*)/);
        if (!poMatch) continue;
        const predicate = resolve(poMatch[1]);
        const objStr = poMatch[2].trim();

        // Handle "a" keyword for rdf:type
        const predResolved = poMatch[1].trim() === 'a' ? RDF_TYPE : predicate;

        // Split objects by ',' (not in quotes)
        const objs = [];
        let obj = '';
        inQuotes = false;
        for (let i = 0; i < objStr.length; i++) {
          const ch = objStr[i];
          if (ch === '"' && objStr[i - 1] !== '\\') inQuotes = !inQuotes;
          if (ch === ',' && !inQuotes) {
            objs.push(obj.trim());
            obj = '';
          } else {
            obj += ch;
          }
        }
        if (obj.trim()) objs.push(obj.trim());

        for (const o of objs) {
          if (!o) continue;
          const objValue = extractTerm(o);

          // Check if this is a type declaration matching memberIri
          if (predResolved === RDF_TYPE && objValue === memberIri) {
            if (!members[subject]) {
              members[subject] = { iri: subject, label: '', definition: '' };
            }
          }

          // Collect label and definition for known members
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

    const result = Object.values(members);

    return Response.json({
      status: 'success',
      member_count: result.length,
      member_identifier_resolved: memberIri,
      members: result,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});