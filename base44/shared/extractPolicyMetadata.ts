/**
 * extractPolicyMetadata — focused, lossless extractor for the auto-derived
 * Policy Index fields (legal-code links, citation metadata, publication info).
 *
 * The canonical policy TTLs keep all of this metadata as FLAT predicate-object
 * pairs on the policy subject, BEFORE the `odrl:permission [ ... ]` rules
 * block. We therefore collect top-level (depth 0) predicate-object segments
 * and STOP at the first top-level `[` or `.` — the rules block (with its
 * unbalanced/real-world blank nodes) is never parsed, which makes this
 * robust to the known Turtle quirks in the policy files.
 *
 * Shared by the indexPolicies backend function; framework-agnostic vanilla TS.
 */

const OPENREL = 'http://www.w3.org/ns/openrel/0/';
const DCT = 'http://purl.org/dc/terms/';
const PROV = 'http://www.w3.org/ns/prov#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

// Predicates that carry unescaped inner quotes (e.g. the CC0 "Waiver") break a
// naive quote tracker. This mirrors the standalone wizard's normalization:
// append `.` to bare @prefix/@base, and escape unescaped `"` inside a single
// single-line literal statement.
function normalizeTtl(ttl: string): string {
  return ttl.split('\n').map((line) => {
    const t = line.trim();
    if (/^@(prefix|base)\s+\S+\s+<[^>]*>\s*$/.test(t) && !t.endsWith('.')) {
      return line.replace(/\s*$/, '') + ' .';
    }
    const m = line.match(/^(\s*\S+\s+)"(.*)"(@\w+|\^\^[^ ]+)?\s*([;.]?)\s*$/);
    if (m && !m[2].includes(';') && /(?<!\\)"/.test(m[2])) {
      const escaped = m[2].replace(/(?<!\\)"/g, '\\"');
      return `${m[1]}"${escaped}"${m[3] || ''}${m[4] || ''}`;
    }
    return line;
  }).join('\n');
}

export interface PolicyMetadata {
  subject_iri: string;
  subject_curie: string;
  // Parameter IRIs referenced as right operands in the policy's constraints
  // (full scan of the TTL, including the rules block the flat extractor skips).
  // Resolved to prefLabels by the indexer via the parameters concept scheme.
  parameter_iris: string[];
  legal_code: {
    legal_code: string | null;
    policy_text_html: string | null;
    policy_text: string | null;
    encoded_rules: string | null;
    source: string | null;
    relations: string[];
  };
  citation: {
    title: string | null;
    alternative: string[];
    description: string | null;
    creator: string[];
    contributor: string[];
    subject: string[];
    derived_from: string[];
    attributed_to: string[];
  };
  publication: {
    publisher: string | null;
    created: string | null;
    modified: string | null;
    issued: string | null;
    version: string | null;
    policy_status: string | null;
  };
}

const LEGAL_LINK_PREDS: Record<string, keyof PolicyMetadata['legal_code']> = {
  [OPENREL + 'legalCode']: 'legal_code',
  [OPENREL + 'legalcode']: 'legal_code',
  [OPENREL + 'policyTextHtml']: 'policy_text_html',
  [OPENREL + 'policyText']: 'policy_text',
  [OPENREL + 'encodedRules']: 'encoded_rules',
  [DCT + 'source']: 'source',
  [DCT + 'relation']: 'relations',
};
const CITATION_PREDS: Record<string, keyof PolicyMetadata['citation']> = {
  [DCT + 'title']: 'title',
  [DCT + 'alternative']: 'alternative',
  [DCT + 'description']: 'description',
  [DCT + 'creator']: 'creator',
  [DCT + 'contributor']: 'contributor',
  [DCT + 'subject']: 'subject',
  [PROV + 'wasDerivedFrom']: 'derived_from',
  [PROV + 'wasAttributedTo']: 'attributed_to',
};
const PUBLICATION_PREDS: Record<string, keyof PolicyMetadata['publication']> = {
  [DCT + 'publisher']: 'publisher',
  [DCT + 'created']: 'created',
  [DCT + 'modified']: 'modified',
  [DCT + 'issued']: 'issued',
  [DCT + 'version']: 'version',
  [OPENREL + 'policyStatus']: 'policy_status',
};

export function compactForIndex(iri: string): string {
  if (iri.startsWith(OPENREL)) return 'openrel:' + iri.substring(OPENREL.length);
  if (iri.startsWith(DCT)) return 'dct:' + iri.substring(DCT.length);
  return iri;
}

export function extractPolicyMetadata(ttl: string): PolicyMetadata | null {
  const normalized = normalizeTtl(ttl);

  // Capture prefixes + @base
  const prefixes: Record<string, string> = {};
  let pm: RegExpExecArray | null;
  const prefixRe = /@prefix\s+([^:\s]+):\s+<([^>]+)>\s*\./g;
  while ((pm = prefixRe.exec(normalized)) !== null) prefixes[pm[1].trim()] = pm[2];
  const baseMatch = normalized.match(/@base\s+<([^>]+)>\s*\./);
  const baseIri = baseMatch ? baseMatch[1] : null;
  // prov: is used in policy metadata but sometimes undeclared.
  if (!prefixes['prov']) prefixes['prov'] = PROV;

  function resolveTerm(term: string): string {
    term = term.trim();
    if (term.startsWith('<') && term.endsWith('>')) {
      let v = term.slice(1, -1);
      if (!/^[a-z][a-z0-9+.-]*:/i.test(v) && baseIri) {
        v = (baseIri.endsWith('/') ? baseIri : baseIri + '/') + v;
      }
      return v;
    }
    if (term === 'a') return RDF_TYPE;
    const ci = term.indexOf(':');
    if (ci > 0) {
      const pfx = term.substring(0, ci);
      const local = term.substring(ci + 1);
      if (prefixes[pfx]) return prefixes[pfx] + local;
    }
    return term;
  }

  function parseObject(o: string): { kind: 'literal' | 'iri'; value: string } {
    o = o.trim();
    if (o.startsWith('"')) {
      let end = 1;
      while (end < o.length) {
        if (o[end] === '"' && o[end - 1] !== '\\') break;
        end++;
      }
      let value = o.substring(1, end)
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\\//g, '/');
      return { kind: 'literal', value };
    }
    return { kind: 'iri', value: compactForIndex(resolveTerm(o)) };
  }

  // Strip @prefix/@base lines, then strip comments (outside quotes).
  let noprefix = normalized.replace(/@prefix[^\n]*\n?/g, '').replace(/@base[^\n]*\n?/g, '');
  let body = '';
  let inStr = false;
  for (let i = 0; i < noprefix.length; i++) {
    const ch = noprefix[i];
    if (ch === '"' && noprefix[i - 1] !== '\\') inStr = !inStr;
    if (ch === '#' && !inStr) {
      while (i < noprefix.length && noprefix[i] !== '\n') i++;
      continue;
    }
    body += ch;
  }
  body = body.trim();
  if (!body) return null;

  // Subject = first token.
  const subjMatch = body.match(/^\s*(<[^>]+>|\S+)/);
  if (!subjMatch) return null;
  const subjectIri = resolveTerm(subjMatch[1]);
  const rest = body.substring(subjMatch[0].length);

  // Collect top-level predicate-object segments until the first top-level `[`
  // (start of the rules block) or `.` (end of the policy statement).
  const rawProps: Record<string, { kind: string; value: string }[]> = {};
  let buf = '';
  let inStr2 = false, inAngle = false, depth = 0, stopped = false;
  for (let i = 0; i < rest.length && !stopped; i++) {
    const ch = rest[i];
    const prev = rest[i - 1];
    if (ch === '"' && prev !== '\\') inStr2 = !inStr2;
    buf += ch;
    if (inStr2) continue;
    if (ch === '<') inAngle = true;
    else if (ch === '>') inAngle = false;
    if (inAngle) continue;
    if (ch === '[') {
      depth++;
      if (depth === 1) { stopped = true; break; } // rules block begins
    } else if (ch === ']') {
      depth = Math.max(0, depth - 1);
    }
    if (depth === 0) {
    if (ch === ';') {
      flushSegment(buf.replace(/;$/, '').trim());
      buf = '';
    } else if (ch === '.') {
      // A '.' is a statement terminator only when followed by whitespace or
      // EOF, so decimals inside CURIEs (spdx:CC0-1.0) don't end the segment.
      const nextCh = rest[i + 1];
      if (nextCh === undefined || /\s/.test(nextCh)) {
        flushSegment(buf.replace(/\.$/, '').trim());
        stopped = true;
        break;
      }
    }
    }
  }
  if (!stopped && buf.trim()) flushSegment(buf.trim());

  function flushSegment(seg: string) {
    const s = seg.trim();
    if (!s) return;
    const m = s.match(/^(\S+)\s+([\s\S]*)/);
    if (!m) return;
    const predIri = resolveTerm(m[1]);
    const objPart = m[2].trim();
    // Split objects by `,` at depth 0, outside quotes/angles.
    const objs: string[] = [];
    let ob = '', d2 = 0, is2 = false, ia2 = false;
    for (let i = 0; i < objPart.length; i++) {
      const ch = objPart[i];
      if (ch === '"' && objPart[i - 1] !== '\\') is2 = !is2;
      if (!is2) {
        if (ch === '<') ia2 = true;
        else if (ch === '>') ia2 = false;
        if (!ia2) {
          if (ch === '[') d2++;
          else if (ch === ']') d2 = Math.max(0, d2 - 1);
          if (d2 === 0 && ch === ',') { objs.push(ob.trim()); ob = ''; continue; }
        }
      }
      ob += ch;
    }
    if (ob.trim()) objs.push(ob.trim());
    for (const o of objs) {
      if (!o) continue;
      if (!rawProps[predIri]) rawProps[predIri] = [];
      rawProps[predIri].push(parseObject(o));
    }
  }

  const getLiteral = (iri: string): string | null => {
    const v = rawProps[iri];
    return v && v[0] ? v[0].value : null;
  };
  const getAll = (iri: string): string[] => (rawProps[iri] || []).map((v) => v.value);

  // Parameters: full-scan the TTL for odrl:rightOperand / rightOperandReference
  // tokens that are IRI/CURIE references (skip literal right operands). These
  // live inside the rules block the flat extractor deliberately stops at, so
  // we scan the whole normalized document. Each token is resolved to a full
  // IRI; the indexer maps it to a prefLabel via parameters.ttl.
  const paramSet = new Set<string>();
  const paramRe = /odrl:rightOperand(?:Reference)?\s+("[^"]*"|<[^>]+>|\S+)/g;
  let pmm: RegExpExecArray | null;
  while ((pmm = paramRe.exec(normalized)) !== null) {
    let tok = pmm[1].replace(/[;,\]\s]+$/, '').trim();
    if (!tok || tok.startsWith('"')) continue; // literal right operand — not a parameter ref
    if (tok.startsWith('<') && tok.endsWith('>')) tok = tok.slice(1, -1);
    paramSet.add(resolveTerm(tok));
  }
  const parameter_iris = [...paramSet];

  const legal_code = {
    legal_code: getLiteral(OPENREL + 'legalCode') || getLiteral(OPENREL + 'legalcode'),
    policy_text_html: getLiteral(OPENREL + 'policyTextHtml'),
    policy_text: getLiteral(OPENREL + 'policyText'),
    encoded_rules: getLiteral(OPENREL + 'encodedRules'),
    source: getLiteral(DCT + 'source'),
    relations: getAll(DCT + 'relation'),
  };
  const citation = {
    title: getLiteral(DCT + 'title'),
    alternative: getAll(DCT + 'alternative'),
    description: getLiteral(DCT + 'description'),
    creator: getAll(DCT + 'creator'),
    contributor: getAll(DCT + 'contributor'),
    subject: getAll(DCT + 'subject'),
    derived_from: getAll(PROV + 'wasDerivedFrom'),
    attributed_to: getAll(PROV + 'wasAttributedTo'),
  };
  const publication = {
    publisher: getLiteral(DCT + 'publisher'),
    created: getLiteral(DCT + 'created'),
    modified: getLiteral(DCT + 'modified'),
    issued: getLiteral(DCT + 'issued'),
    version: getLiteral(DCT + 'version'),
    policy_status: getLiteral(OPENREL + 'policyStatus'),
  };

  return {
    subject_iri: subjectIri,
    subject_curie: compactForIndex(subjectIri),
    parameter_iris,
    legal_code, citation, publication,
  };
}

// Curated field keys the indexer must never overwrite.
export const CURATED_FIELDS = [
  'iri', 'label', 'description', 'type', 'status', 'tags',
  'is_composite', 'hasPolicy', 'simple',
];

// The three auto-derived objects the indexer owns.
export const DERIVED_FIELDS = ['legal_code', 'citation', 'publication'] as const;