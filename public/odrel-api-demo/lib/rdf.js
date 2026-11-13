/**
 * rdf.js — Minimal Turtle reader/writer used by the standalone API demo.
 *
 * This is a browser port of the parsing and serialising core used by the
 * hosted `fetchApiSourceContent` function, so the offline bundle returns the
 * same member shapes (iri / label / definition / properties) and the same
 * Turtle, JSON and JSON-LD representations.
 */

(function () {
'use strict';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#';
const SKOS_NS = 'http://www.w3.org/2004/02/skos/core#';
const SKOS_PREF_LABEL = SKOS_NS + 'prefLabel';
const RDFS_LABEL = RDFS_NS + 'label';
const SKOS_DEFINITION = SKOS_NS + 'definition';

// Strip Turtle comments, leaving '#' alone inside an IRI (<...>) or literal ("...").
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

function resolveCurie(curie, prefixes) {
  if (!curie) return null;
  curie = String(curie).trim();
  if (curie.startsWith('<') && curie.endsWith('>')) return curie.slice(1, -1);
  const colonIdx = curie.indexOf(':');
  if (colonIdx > 0) {
    const prefix = curie.substring(0, colonIdx);
    const local = curie.substring(colonIdx + 1);
    if (prefixes[prefix]) return prefixes[prefix] + local;
  }
  return curie;
}

/**
 * Parse a Turtle document.
 * `memberIdentifier` may list several types (comma separated). When it is
 * null/empty every subject counts as a member (folder mode).
 */
function parseTurtle(text, memberIdentifier) {
  const prefixes = {};
  const prefixRegex = /@prefix\s+([A-Za-z0-9_.-]*):\s*<([^>]+)>\s*\./g;
  let pmatch;
  while ((pmatch = prefixRegex.exec(text)) !== null) {
    prefixes[pmatch[1]] = pmatch[2];
  }

  const baseMatch = text.match(/@base\s+<([^>]+)>\s*\./);
  const baseIri = baseMatch ? baseMatch[1] : null;

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
    if (colonIdx >= 0) {
      const prefix = term.substring(0, colonIdx);
      const local = term.substring(colonIdx + 1);
      if (prefixes[prefix]) return prefixes[prefix] + local;
    }
    return term;
  }

  const allSubjectsMode = !memberIdentifier;
  const memberIris = new Set();
  for (const part of String(memberIdentifier || '').split(',')) {
    const term = part.trim();
    if (!term) continue;
    memberIris.add(term.includes(':') && !term.startsWith('<') ? resolve(term) : term);
  }
  const memberIri = [...memberIris].join(', ');

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
        const objValue = extractTerm(o);
        const objRaw = withDefaultAlias(extractTerm(o, true));
        const isLiteral = o.trim().startsWith('"');

        if (predResolved === RDF_TYPE && memberIris.has(objValue)) {
          if (!members[subject]) members[subject] = { iri: subject, label: '', definition: '', properties: [] };
        }
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

function parseJsonMembers(text, memberIdentifier) {
  const parsed = JSON.parse(text);
  let items = [];

  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
    items = parsed['@graph'];
  } else if (typeof parsed === 'object') {
    for (const key of ['items', 'members', 'concepts', 'values']) {
      if (Array.isArray(parsed[key])) { items = parsed[key]; break; }
    }
    if (items.length === 0) items = [parsed];
  }

  if (memberIdentifier) {
    const filtered = items.filter((item) => {
      const types = item['@type'] || item.type;
      if (Array.isArray(types)) return types.includes(memberIdentifier);
      return types === memberIdentifier;
    });
    if (filtered.length > 0) items = filtered;
  }

  const members = items.map((item) => ({
    iri: item['@id'] || item.id || item.iri || item.openrel_IRI || item.uri || '',
    label: item.prefLabel || item.label || item.name || item.title || item['skos:prefLabel'] || '',
    definition: item.definition || item.description || item['skos:definition'] || '',
    url: item.url || item.link || item.href || '',
    properties: item,
  }));

  return { members, memberIdentifierResolved: memberIdentifier };
}

function escapeTtlLiteral(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function membersToTurtle(members, memberIdentifierResolved, prefixes) {
  prefixes = prefixes || {};

  function iriToCurie(iri) {
    if (!iri.startsWith('http') && !iri.startsWith('www') && iri.includes(':')) return iri;
    for (const [prefix, ns] of Object.entries(prefixes)) {
      if (prefix && iri.startsWith(ns)) return `${prefix}:${iri.substring(ns.length)}`;
    }
    return `<${iri}>`;
  }

  const usedPrefixes = new Set();
  function collectFromIri(iri) {
    if (!iri) return;
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
    if (Array.isArray(m.properties)) {
      for (const p of m.properties) {
        collectFromIri(p.predicate);
        if (!p.is_literal) collectFromIri(p.object);
      }
    }
    for (const mp of m.mappings || []) {
      collectFromIri(mp.predicate);
      collectFromIri(mp.object);
    }
  }

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
    if (!hardcoded.has(prefix)) lines.push(`@prefix ${prefix}: <${prefixes[prefix]}> .`);
  }
  lines.push('');

  for (const m of members) {
    const iri = m.iri || '';
    if (!iri) continue;

    if (Array.isArray(m.properties) && m.properties.length > 0) {
      const parts = m.properties.map((p) => {
        const predDisplay = p.predicate === RDF_TYPE ? 'a' : iriToCurie(p.predicate);
        const objDisplay = p.is_literal ? `"${escapeTtlLiteral(p.object)}"` : iriToCurie(p.object);
        return `    ${predDisplay} ${objDisplay}`;
      });
      lines.push(`${iri} ${parts.join(' ;\n')} .`);
    } else {
      const parts = [`${iri} a ${typeCurie}`];
      if (m.label) parts.push(`    skos:prefLabel "${escapeTtlLiteral(m.label)}"`);
      if (m.definition) parts.push(`    skos:definition "${escapeTtlLiteral(m.definition)}"`);
      for (const mp of m.mappings || []) {
        parts.push(`    ${mp.predicate} ${iriToCurie(mp.object)}`);
      }
      lines.push(parts.join(' ;\n') + ' .');
    }
    lines.push('');
  }

  return lines.join('\n');
}

const JSONLD_RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';

function toCompact(iri, prefixes) {
  if (!iri || typeof iri !== 'string') return iri;
  if (!/^https?:\/\//.test(iri)) return iri;
  for (const [prefix, ns] of Object.entries(prefixes || {})) {
    if (!prefix) continue;
    if (ns && iri.startsWith(ns)) return `${prefix}:${iri.substring(ns.length)}`;
  }
  return iri;
}

function membersToJsonLd(members, memberIdentifierResolved, prefixes) {
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

    for (const mp of m.mappings || []) {
      if (!mp || !mp.predicate) continue;
      const value = { '@id': toCompact(mp.object, prefixes) };
      if (node[mp.predicate] === undefined) node[mp.predicate] = value;
      else if (Array.isArray(node[mp.predicate])) node[mp.predicate].push(value);
      else node[mp.predicate] = [node[mp.predicate], value];
    }

    return node;
  });

  const context = {
    rdf: JSONLD_RDF_NS,
    rdfs: RDFS_NS,
    skos: SKOS_NS,
  };
  for (const [prefix, ns] of Object.entries(prefixes || {})) {
    if (!prefix) continue;
    if (!context[prefix] && ns) context[prefix] = ns;
  }

  return { '@context': context, '@graph': nodes };
}

/**
 * Folder mode helper: pick the subject that carries the configured title or
 * description field, otherwise the first subject in document order.
 */
function findPrimarySubject(parsed, titleFieldIri, descriptionFieldIri) {
  const members = parsed.members || [];
  if (members.length === 0) return null;
  return members.find((m) =>
    (m.properties || []).some((p) => p.predicate === titleFieldIri || p.predicate === descriptionFieldIri)
  ) || members[0];
}

// Exposed on window so the demo runs as plain scripts, including from file://.
window.RDF = {
  RDF_TYPE,
  resolveCurie,
  parseTurtle,
  parseJsonMembers,
  membersToTurtle,
  membersToJsonLd,
  findPrimarySubject,
};
})();
