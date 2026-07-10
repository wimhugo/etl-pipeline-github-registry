import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * syncMappings
 * ------------
 * Triggered when an ApiSourceFile is created or updated.
 *
 * Parses the source file, extracts all skos mapping properties
 * (exactMatch, closeMatch, broadMatch, narrowMatch), inverts them
 * per the inverse-logic table, and appends/deduplicates the results
 * into the system-managed mappings.ttl file in GitHub.
 *
 * Inverse logic:
 *   exactMatch  → exactMatch   (symmetric)
 *   closeMatch  → closeMatch   (symmetric)
 *   broadMatch  → narrowMatch
 *   narrowMatch → broadMatch
 *
 * The mappings.ttl file is itself a standard ApiSourceFile (section "Mappings",
 * is_system = true) so it gets list/detail endpoints and prefix filtering
 * for free.
 */

const MAPPINGS_FILE_PATH = '.openrel/vocabs/openrel/mappings.ttl';

const MAPPING_INVERSE = {
  'http://www.w3.org/2004/02/skos/core#exactMatch': 'http://www.w3.org/2004/02/skos/core#exactMatch',
  'http://www.w3.org/2004/02/skos/core#closeMatch': 'http://www.w3.org/2004/02/skos/core#closeMatch',
  'http://www.w3.org/2004/02/skos/core#broadMatch': 'http://www.w3.org/2004/02/skos/core#narrowMatch',
  'http://www.w3.org/2004/02/skos/core#narrowMatch': 'http://www.w3.org/2004/02/skos/core#broadMatch',
};

const SKOS_NS = 'http://www.w3.org/2004/02/skos/core#';
const RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#';
const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';

// --- Lightweight TTL parser for the mappings file ---
// Extracts @prefix declarations and subject-predicate-object triples
// as raw CURIEs.  Only mapping predicates are retained.
function parseMappingsTtl(text) {
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

  const tripleSet = new Set();
  const triples = [];

  const cleaned = text
    .replace(/#[^\n]*/g, '')
    .replace(/@prefix\s+[^:]+:\s+<[^>]+>\s*\./g, '')
    .replace(/@base\s+<[^>]+>\s*\./g, '');

  // Split into statements (terminated by '.')
  const statements = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '"' && cleaned[i - 1] !== '\\') inQuotes = !inQuotes;
    current += ch;
    if (ch === '.' && !inQuotes) {
      statements.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) statements.push(current.trim());

  function isValidCurie(term) {
    if (!term || term === 'a') return false;
    if (/[/<>"'{}|^`]/.test(term)) return false;
    return term.includes(':');
  }

  for (const stmt of statements) {
    if (!stmt || stmt === '.') continue;
    const subjMatch = stmt.match(/^(\S+)\s+([\s\S]*)/);
    if (!subjMatch) continue;
    const subject = subjMatch[1].trim();
    if (subject === '.') continue;
    const subjectCurie = subject.startsWith('<') ? subject.slice(1, -1) : subject;
    if (!isValidCurie(subjectCurie)) continue;
    const rest = subjMatch[2].trim();

    // Split predicate-object pairs by ';'
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
      const predRaw = poMatch[1].trim();
      const predResolved = predRaw === 'a' ? RDF_NS + 'type' : resolve(predRaw);

      // Only collect mapping predicates (skip a, rdfs:label, etc.)
      if (!MAPPING_INVERSE[predResolved]) continue;
      const predCurie = predRaw === 'a' ? 'a' : predRaw;

      const objStr = poMatch[2].trim().replace(/\.$/, '').trim();

      // Split objects by ','
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
        const objCurie = o.startsWith('<') ? o.slice(1, -1) : o;
        if (!isValidCurie(objCurie)) continue;
        const key = `${subjectCurie}|${predCurie}|${objCurie}`;
        if (!tripleSet.has(key)) {
          tripleSet.add(key);
          triples.push({ subject: subjectCurie, predicate: predCurie, object: objCurie });
        }
      }
    }
  }

  return { prefixes, triples, tripleSet };
}

// --- TTL serializer for mappings ---
function serializeMappingsTtl(triples, prefixes) {
  // Collect used prefixes
  const usedPrefixes = new Set(['rdf', 'rdfs', 'skos']);

  function collectFromTerm(term) {
    if (term.startsWith('http')) {
      for (const [prefix, ns] of Object.entries(prefixes)) {
        if (term.startsWith(ns)) { usedPrefixes.add(prefix); break; }
      }
    } else {
      const colonIdx = term.indexOf(':');
      if (colonIdx > 0) {
        const prefix = term.substring(0, colonIdx);
        if (prefixes[prefix]) usedPrefixes.add(prefix);
      }
    }
  }

  for (const t of triples) {
    collectFromTerm(t.subject);
    collectFromTerm(t.object);
  }

  // Group triples by subject
  const bySubject = {};
  for (const t of triples) {
    if (!bySubject[t.subject]) bySubject[t.subject] = [];
    bySubject[t.subject].push(t);
  }

  const lines = [
    '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',
    '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
    '@prefix skos: <http://www.w3.org/2004/02/skos/core#> .',
  ];
  const hardcoded = new Set(['rdf', 'rdfs', 'skos']);
  for (const prefix of usedPrefixes) {
    if (!hardcoded.has(prefix) && prefixes[prefix]) {
      lines.push(`@prefix ${prefix}: <${prefixes[prefix]}> .`);
    }
  }
  lines.push('');

  function escapeLiteral(str) {
    return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function localName(curie) {
    const idx = Math.max(curie.lastIndexOf(':'), curie.lastIndexOf('/'), curie.lastIndexOf('#'));
    return idx >= 0 ? curie.substring(idx + 1) : curie;
  }

  // Sort subjects alphabetically for clean diffs
  const sortedSubjects = Object.keys(bySubject).sort();
  for (const subject of sortedSubjects) {
    const preds = bySubject[subject];
    const parts = ['a skos:Concept', `rdfs:label "${escapeLiteral(localName(subject))}"`];
    for (const p of preds) {
      parts.push(`${p.predicate} ${p.object}`);
    }
    lines.push(subject);
    for (let i = 0; i < parts.length; i++) {
      lines.push(`    ${parts[i]}${i < parts.length - 1 ? ' ;' : ' .'}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { section, source_file_id } = body;

    if (!section && !source_file_id) {
      return Response.json({ error: 'section or source_file_id is required' }, { status: 400 });
    }

    // 1. Look up the source file
    let sourceFile;
    if (source_file_id) {
      sourceFile = await base44.asServiceRole.entities.ApiSourceFile.get(source_file_id);
    } else {
      const matches = await base44.asServiceRole.entities.ApiSourceFile.filter({ section });
      sourceFile = matches[0];
    }

    if (!sourceFile) {
      return Response.json({ error: `No source file found for section "${section}"` }, { status: 404 });
    }

    // Skip system-generated sources (Mappings itself, etc.)
    if (sourceFile.is_system) {
      return Response.json({ status: 'skipped', message: 'System sources are not synced as mapping origins' });
    }

    // 2. Fetch parsed content with full properties via fetchApiSourceContent
    const fetchResult = await base44.asServiceRole.functions.invoke('fetchApiSourceContent', {
      section: sourceFile.section,
      keep_properties: true,
    });
    const fetchData = fetchResult?.data ?? fetchResult;
    const members = fetchData?.members || [];
    const sourcePrefixes = fetchData?.prefixes || {};

    if (members.length === 0) {
      return Response.json({ status: 'success', message: 'No members found in source file', mappings_added: 0 });
    }

    // 3. Extract mapping properties and invert them
    const newTriples = [];
    const newTripleSet = new Set();

    for (const member of members) {
      if (!member.properties) continue;
      const openrelIri = member.iri;

      for (const prop of member.properties) {
        const inversePred = MAPPING_INVERSE[prop.predicate];
        if (!inversePred) continue; // not a mapping property
        if (prop.is_literal) continue; // mappings must be IRIs

        // Invert: subject becomes the external term, object becomes the openrel term
        const externalTerm = prop.object; // raw CURIE (e.g. "odrl:use")

        // Convert inverse predicate IRI to CURIE
        let predCurie;
        if (inversePred.startsWith(SKOS_NS)) {
          predCurie = 'skos:' + inversePred.substring(SKOS_NS.length);
        } else {
          predCurie = inversePred;
        }

        const key = `${externalTerm}|${predCurie}|${openrelIri}`;
        if (!newTripleSet.has(key)) {
          newTripleSet.add(key);
          newTriples.push({ subject: externalTerm, predicate: predCurie, object: openrelIri });
        }
      }
    }

    if (newTriples.length === 0) {
      return Response.json({ status: 'success', message: 'No mapping properties found in source file', mappings_added: 0 });
    }

    // 4. Resolve GitHub credentials
    const configs = await base44.asServiceRole.entities.GlobalConfig.list();
    const config = configs[0] || {};
    const token = config.github_token || Deno.env.get('GITHUB_TOKEN');
    const githubRepo = config.github_repo || 'wimhugo/openrel';
    const branch = config.github_branch || 'main';

    if (!token) {
      return Response.json({ error: 'No GitHub token configured' }, { status: 400 });
    }

    const ghHeaders = {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'OpenREL-App',
    };

    // 5. Fetch current mappings.ttl from GitHub (to get SHA + existing content)
    const getUrl = `https://api.github.com/repos/${githubRepo}/contents/${MAPPINGS_FILE_PATH}?ref=${branch}`;
    const getResp = await fetch(getUrl, { headers: ghHeaders });

    let existingSha = null;
    let existingText = '';
    let existingPrefixes = {};
    let existingTripleSet = new Set();

    if (getResp.ok) {
      const fileData = await getResp.json();
      existingSha = fileData.sha;
      existingText = atob(fileData.content.replace(/\n/g, ''));
      const parsed = parseMappingsTtl(existingText);
      existingPrefixes = parsed.prefixes;
      existingTripleSet = parsed.tripleSet;
    } else if (getResp.status === 404) {
      // File doesn't exist yet — will be created
    } else {
      const errText = await getResp.text();
      return Response.json({ error: `GitHub GET ${getResp.status}: ${errText.substring(0, 200)}` }, { status: 502 });
    }

    // 6. Merge: add only triples that don't already exist
    const mergedPrefixes = { ...existingPrefixes, ...sourcePrefixes };
    let addedCount = 0;

    for (const t of newTriples) {
      const key = `${t.subject}|${t.predicate}|${t.object}`;
      if (!existingTripleSet.has(key)) {
        existingTripleSet.add(key);
        addedCount++;
      }
    }

    // Rebuild full triple list from the merged set
    const allTriples = [];
    for (const key of existingTripleSet) {
      const [subject, predicate, object] = key.split('|');
      allTriples.push({ subject, predicate, object });
    }

    // 7. Serialize and write back
    const ttlContent = serializeMappingsTtl(allTriples, mergedPrefixes);

    const putBody = {
      message: `chore: sync mappings from ${sourceFile.section} (${addedCount} new)`,
      content: btoa(unescape(encodeURIComponent(ttlContent))),
      branch,
    };
    if (existingSha) putBody.sha = existingSha;

    const putUrl = `https://api.github.com/repos/${githubRepo}/contents/${MAPPINGS_FILE_PATH}`;
    const putResp = await fetch(putUrl, { method: 'PUT', headers: ghHeaders, body: JSON.stringify(putBody) });
    const putData = await putResp.json();

    if (!putResp.ok) {
      return Response.json({ error: `GitHub PUT ${putResp.status}: ${putData.message || ''}` }, { status: 502 });
    }

    return Response.json({
      status: 'success',
      section: sourceFile.section,
      mappings_extracted: newTriples.length,
      mappings_added: addedCount,
      total_mappings: allTriples.length,
      file_sha: putData.content?.sha,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});