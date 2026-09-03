import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveGithubCredentials } from '../../shared/resolveGithubCredentials.ts';
import { submitGithubPR } from '../../shared/submitGithubPR.ts';

/**
 * ReasonerUpdate
 * --------------
 * Builds the OpenREL Reasoner Graph (data/reasoner/graph_reasoner.ttl) — a
 * reified, human-editable graph of assertions between actions using the
 * type_evaluation relations:
 *   openrel:includedIn · openrel:contradicts · openrel:implies ·
 *   openrel:allows · openrel:compatible · openrel:missing
 *
 * Assertions are produced in three tiers:
 *   - Deterministic  — derived mechanically:
 *       · actions.ttl: odrl:includedIn, skos mapping propagation,
 *         openrel:defaultDuty (→ implies), authored openrel:contradicts
 *       · DALICC dependency graph (dg_default.ttl, live from dalicc/dalicc):
 *         odrl:includedIn, odrl:implies (object role Duty),
 *         dalicc:contradicts — canonicalized via owl:sameAs and resolved to
 *         openrel IRIs through the actions.ttl skos mappings. Unmapped
 *         external IRIs are kept as-is.
 *   - Corpus         — statistical evidence from the DALICC licence corpus
 *     snapshot in the Knowledge Base repo (data/input/dalicc, ~343 odrl:Set
 *     TTLs): permission→duty co-occurrence (→ implies) and prohibition∩
 *     permission co-existence (→ openrel:allows), each with a support count,
 *     filtered by a minimum-support threshold. Fetched with a single repo
 *     tarball download, extracting the licence TTLs in memory (per-file
 *     downloads caused the earlier hangs).
 *   - Probabilistic  — LLM-draft edges with confidence + rationale, for
 *     human review.
 *
 * Assertion model: subject/object IRIs plus a role pair (subjectRole /
 * objectRole: odrl:Permission / Prohibition / Duty). Legacy graphs that only
 * carry openrel:role are read with role → objectRole.
 *
 * Merge rule (extended shadow rule): Deterministic > Corpus > Probabilistic —
 * an assertion is dropped when an assertion of a stronger tier already exists
 * for the same edge key (subject | relation | object | roles).
 *
 * Preservation: re-runs regenerate every from-source edge, but PRESERVE:
 *   - existing human-authored deterministic/corpus assertions
 *     (dct:source "manual"/"curated")
 *   - existing probabilistic assertions (curator review survives) — unless a
 *     stronger tier now shadows them.
 *
 * On apply, openrel:allows is authored into actions.ttl (same PR) when not
 * yet defined. Output is a reified, commented, editable TTL committed via PR.
 *
 * Payload:
 * {
 *   dry_run?: boolean, skip_llm?: boolean, model?: string, message?: string,
 *   curated_assertions?: Assertion[],
 *   sources?: {
 *     actions_path?: string,
 *     dg_enabled?: boolean, dg_repo?: string, dg_branch?: string, dg_path?: string,
 *     corpus_enabled?: boolean, corpus_folder?: string, corpus_min_support?: number,
 *     corpus_limit?: number (test aid: only use the first N licence files)
 *   }
 * }
 */

const GRAPH_FILE = 'data/reasoner/graph_reasoner.ttl';
const OPENREL = 'http://www.w3.org/ns/openrel/0/';
const ODRL = 'http://www.w3.org/ns/odrl/2/';
const SKOS = 'http://www.w3.org/2004/02/skos/core#';
const DCT = 'http://purl.org/dc/terms/';
const XSD = 'http://www.w3.org/2001/XMLSchema#';
const OWL = 'http://www.w3.org/2002/07/owl#';
const DALICC = 'https://dalicc.net/ns#';
const CC = 'http://creativecommons.org/ns#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

const REL_INCLUDEDIN = OPENREL + 'includedIn';
const REL_CONTRADICTS = OPENREL + 'contradicts';
const REL_IMPLIES = OPENREL + 'implies';
const REL_ALLOWS = OPENREL + 'allows';
const ROLE_PERMISSION = ODRL + 'Permission';
const ROLE_PROHIBITION = ODRL + 'Prohibition';
const ROLE_DUTY = ODRL + 'Duty';

type Derivation = 'Deterministic' | 'Corpus' | 'Probabilistic';

interface Assertion {
  subject: string;
  relation: string;
  object: string;
  subjectRole: string | null;
  objectRole: string | null;
  derivation: Derivation;
  source: string;
  confidence?: number;
  rationale?: string;
  support?: number;
}

interface ActionInfo {
  iri: string;
  curie: string;
  label: string;
  definition: string;
  categories: string[];
  includedIn: string[];
  exactMatch: string[];
  broadMatch: string[];
  narrowMatch: string[];
  defaultDuty: string[];
  contradicts: string[];
}

function curieOf(iri: string): string {
  if (iri.startsWith(OPENREL)) return 'openrel:' + iri.substring(OPENREL.length);
  if (iri.startsWith(ODRL)) return 'odrl:' + iri.substring(ODRL.length);
  if (iri.startsWith(SKOS)) return 'skos:' + iri.substring(SKOS.length);
  if (iri.startsWith(DCT)) return 'dct:' + iri.substring(DCT.length);
  if (iri.startsWith(CC)) return 'cc:' + iri.substring(CC.length);
  if (iri.startsWith(DALICC)) return 'dalicc:' + iri.substring(DALICC.length);
  return iri;
}

// ---------------------------------------------------------------------------
// Outbound fetches are timeout-bounded so a stalled GitHub request fails fast
// instead of hanging the whole invocation.
// ---------------------------------------------------------------------------
const FETCH_TIMEOUT_MS = 25000;

async function fetchT(url: string, init: RequestInit = {}, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

// ---------------------------------------------------------------------------
// Flat Turtle parsing helpers (flat statements + balanced-bracket handling
// for ODRL rule blank nodes in licence files).
// ---------------------------------------------------------------------------
function normalizeTtl(ttl: string): string {
  return ttl.replace(/\ufeff/g, '').split('\n').map((line) => {
    const t = line.trim();
    if (/^@(prefix|base)\s+\S+\s+<[^>]*>\s*$/.test(t) && !t.endsWith('.')) {
      return line.replace(/\s*$/, '') + ' .';
    }
    return line;
  }).join('\n');
}

function stripComments(text: string): string {
  let out = '', inStr = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && text[i - 1] !== '\\') inStr = !inStr;
    if (ch === '#' && !inStr) { while (i < text.length && text[i] !== '\n') i++; continue; }
    out += ch;
  }
  return out;
}

function splitTopLevel(text: string, delim: string): string[] {
  const parts: string[] = [];
  let buf = '', inStr = false, inAngle = false, depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && text[i - 1] !== '\\') inStr = !inStr;
    buf += ch;
    if (inStr) continue;
    if (ch === '<') inAngle = true;
    else if (ch === '>') inAngle = false;
    if (inAngle) continue;
    if (ch === '[' || ch === '(') depth++;
    else if (ch === ']' || ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && ch === delim) {
      // A '.' is only a Turtle statement terminator when followed by
      // whitespace or end-of-input — dots inside CURIE locals
      // (e.g. osl:FPL-1.0.0) or decimals must not split statements.
      if (delim === '.' && i + 1 < text.length && !/\s/.test(text[i + 1])) continue;
      parts.push(buf.slice(0, -1));
      buf = '';
    }
  }
  if (buf.trim()) parts.push(buf);
  return parts;
}

interface PrefixCtx {
  prefixes: Record<string, string>;
  baseIri: string | null;
  resolveTerm(term: string): string;
}

function makePrefixCtx(normalized: string): PrefixCtx {
  const prefixes: Record<string, string> = {};
  let pm: RegExpExecArray | null;
  const prefixRe = /@prefix\s+([^:\s]+):\s+<([^>]+)>\s*\./g;
  while ((pm = prefixRe.exec(normalized)) !== null) prefixes[pm[1].trim()] = pm[2];
  const baseMatch = normalized.match(/@base\s+<([^>]+)>\s*\./);
  const baseIri = baseMatch ? baseMatch[1] : null;
  const resolveTerm = (term: string): string => {
    term = term.trim();
    if (term === 'a') return RDF_TYPE;
    if (term.startsWith('<') && term.endsWith('>')) {
      const v = term.slice(1, -1);
      if (baseIri && !/^[a-z][a-z0-9+.-]*:/i.test(v)) {
        return (baseIri.endsWith('/') ? baseIri : baseIri + '/') + v;
      }
      return v;
    }
    const ci = term.indexOf(':');
    if (ci > 0) {
      const pfx = term.substring(0, ci);
      const local = term.substring(ci + 1);
      if (prefixes[pfx]) return prefixes[pfx] + local;
    }
    return term;
  };
  return { prefixes, baseIri, resolveTerm };
}

function ttlBody(normalized: string): string {
  return stripComments(normalized.replace(/@prefix[^\n]*\n?/g, '').replace(/@base[^\n]*\n?/g, ''))
    .replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// actions.ttl parser (flat, class-filtered)
// ---------------------------------------------------------------------------
function parseActionsTtl(ttl: string): { actions: Map<string, ActionInfo> } {
  const normalized = normalizeTtl(ttl);
  const ctx = makePrefixCtx(normalized);
  const body = ttlBody(normalized);
  const actions = new Map<string, ActionInfo>();
  if (!body) return { actions };
  const ACTION_CLASS = new Set([ODRL + 'Action', OPENREL + 'Action']);

  for (const stmt of splitTopLevel(body, '.')) {
    const segs = splitTopLevel(stmt, ';').map((s) => s.trim()).filter(Boolean);
    if (!segs.length) continue;
    const first = segs[0].match(/^(\S+)\s+([\s\S]*)$/);
    if (!first) continue;
    const subjectIri = ctx.resolveTerm(first[1]);
    const segRest = [first[2], ...segs.slice(1)];
    const props: Record<string, string[]> = {};
    for (const seg of segRest) {
      const m = seg.match(/^(\S+)\s+([\s\S]*)$/);
      if (!m) continue;
      const pred = ctx.resolveTerm(m[1]);
      const objs = splitTopLevel(m[2], ',').map((o) => o.trim()).filter(Boolean);
      for (const o of objs) {
        if (!props[pred]) props[pred] = [];
        props[pred].push(o);
      }
    }
    const types = (props[RDF_TYPE] || []).map(ctx.resolveTerm);
    if (!types.some((t) => ACTION_CLASS.has(t))) continue;

    const lit = (iri: string): string => {
      const v = props[iri]?.[0] || '';
      const m = v.match(/^"((?:[^"\\]|\\.)*)"/);
      return m ? m[1].replace(/\\"/g, '"') : '';
    };
    const iris = (iri: string): string[] => (props[iri] || [])
      .filter((o) => !o.startsWith('"') && !o.startsWith('('))
      .map(ctx.resolveTerm);

    actions.set(subjectIri, {
      iri: subjectIri,
      curie: curieOf(subjectIri),
      label: lit(SKOS + 'prefLabel') || lit('http://www.w3.org/2000/01/rdf-schema#label'),
      definition: lit(SKOS + 'definition'),
      categories: iris(OPENREL + 'actionCategory'),
      includedIn: iris(ODRL + 'includedIn'),
      exactMatch: iris(SKOS + 'exactMatch'),
      broadMatch: iris(SKOS + 'broadMatch'),
      narrowMatch: iris(SKOS + 'narrowMatch'),
      defaultDuty: iris(OPENREL + 'defaultDuty'),
      contradicts: iris(OPENREL + 'contradicts'),
    });
  }
  return { actions };
}

// ---------------------------------------------------------------------------
// Generic flat triple parser (dependency graph)
// ---------------------------------------------------------------------------
function parseFlatTriples(ttl: string): { triples: Array<{ s: string; p: string; o: string }> } {
  const normalized = normalizeTtl(ttl);
  const ctx = makePrefixCtx(normalized);
  const body = ttlBody(normalized);
  const triples: Array<{ s: string; p: string; o: string }> = [];
  if (!body) return { triples };
  for (const stmt of splitTopLevel(body, '.')) {
    const segs = splitTopLevel(stmt, ';').map((s) => s.trim()).filter(Boolean);
    if (!segs.length) continue;
    const first = segs[0].match(/^(\S+)\s+([\s\S]*)$/);
    if (!first) continue;
    const s = ctx.resolveTerm(first[1]);
    const rest = [first[2], ...segs.slice(1)];
    for (const seg of rest) {
      const m = seg.match(/^(\S+)\s+([\s\S]*)$/);
      if (!m) continue;
      const p = ctx.resolveTerm(m[1]);
      for (const o of splitTopLevel(m[2], ',')) {
        const oi = ctx.resolveTerm(o.trim());
        if (oi && !oi.startsWith('(')) triples.push({ s, p, o: oi });
      }
    }
  }
  return { triples };
}

// ---------------------------------------------------------------------------
// IRI resolution: owl:sameAs canonicalization + skos reverse map → openrel
// ---------------------------------------------------------------------------
function buildReverseMap(actions: Map<string, ActionInfo>): Map<string, string> {
  const m = new Map<string, string>();
  // exactMatch first (equivalence), then broad/narrow (approximation).
  for (const a of actions.values()) {
    for (const em of a.exactMatch) if (!m.has(em)) m.set(em, a.iri);
  }
  for (const a of actions.values()) {
    for (const x of [...a.broadMatch, ...a.narrowMatch]) if (!m.has(x)) m.set(x, a.iri);
    if (!m.has(a.iri)) m.set(a.iri, a.iri);
  }
  return m;
}

function addSameAs(adj: Map<string, Set<string>>, a: string, b: string) {
  if (!adj.has(a)) adj.set(a, new Set());
  if (!adj.has(b)) adj.set(b, new Set());
  adj.get(a)!.add(b);
  adj.get(b)!.add(a);
}

function resolveExternal(
  iri: string,
  reverseMap: Map<string, string>,
  sameAsAdj: Map<string, Set<string>>,
): string {
  if (reverseMap.has(iri)) return reverseMap.get(iri)!;
  const seen = new Set([iri]);
  const queue = [iri];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const nb of sameAsAdj.get(cur) || []) {
      if (seen.has(nb)) continue;
      seen.add(nb);
      if (reverseMap.has(nb)) return reverseMap.get(nb)!;
      queue.push(nb);
    }
  }
  // No openrel mapping: prefer an odrl-namespace representative.
  for (const nb of sameAsAdj.get(iri) || []) {
    if (nb.startsWith(ODRL)) return nb;
  }
  return iri;
}

// ---------------------------------------------------------------------------
// Edge keys, dedup, sort
// ---------------------------------------------------------------------------
function edgeKey(
  a: Pick<Assertion, 'subject' | 'relation' | 'object' | 'subjectRole' | 'objectRole'>,
): string {
  return [a.subject, a.relation, a.object, a.subjectRole || '', a.objectRole || ''].join('|');
}

function dedupByKey(list: Assertion[]): Assertion[] {
  const seen = new Set<string>();
  return list.filter((a) => {
    const k = edgeKey(a);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function dedupSorted(list: Assertion[]): Assertion[] {
  return dedupByKey(list).sort((a, b) =>
    curieOf(a.subject).localeCompare(curieOf(b.subject)) ||
    curieOf(a.relation).localeCompare(curieOf(b.relation)) ||
    curieOf(a.object).localeCompare(curieOf(b.object)),
  );
}

// ---------------------------------------------------------------------------
// Deterministic pass 1 — actions.ttl
// ---------------------------------------------------------------------------
function deterministicPass(actions: Map<string, ActionInfo>): Assertion[] {
  const out: Assertion[] = [];
  const push = (s: string, rel: string, o: string, objectRole: string | null, source: string) =>
    out.push({ subject: s, relation: rel, object: o, subjectRole: null, objectRole, derivation: 'Deterministic', source });

  const odrlToOpenrel = new Map<string, string>();
  for (const a of actions.values()) {
    for (const em of a.exactMatch) {
      if (em.startsWith(ODRL) && a.iri.startsWith(OPENREL)) odrlToOpenrel.set(em, a.iri);
    }
  }
  const resolveTarget = (iri: string): string => odrlToOpenrel.get(iri) || iri;

  for (const a of actions.values()) {
    for (const inc of a.includedIn) {
      push(a.iri, REL_INCLUDEDIN, resolveTarget(inc), null, 'odrl:includedIn');
    }
    for (const em of a.exactMatch) {
      const b = actions.get(em);
      if (!b) continue;
      for (const c of b.includedIn) {
        push(a.iri, REL_INCLUDEDIN, resolveTarget(c), null, 'skos:exactMatch propagation');
      }
    }
    for (const bm of a.broadMatch) {
      push(resolveTarget(bm), REL_INCLUDEDIN, a.iri, null, 'skos:broadMatch propagation');
    }
    for (const nm of a.narrowMatch) {
      push(a.iri, REL_INCLUDEDIN, resolveTarget(nm), null, 'skos:narrowMatch propagation');
    }
    for (const d of a.defaultDuty) {
      push(a.iri, REL_IMPLIES, resolveTarget(d), ROLE_DUTY, 'openrel:defaultDuty');
    }
    for (const c of a.contradicts) {
      push(a.iri, REL_CONTRADICTS, resolveTarget(c), null, 'authored (openrel:contradicts)');
    }
  }
  return dedupByKey(out);
}

// ---------------------------------------------------------------------------
// Corpus pass — DALICC licence TTLs (odrl:Set with blank-node rule blocks)
// ---------------------------------------------------------------------------
interface LicenceRules {
  permissions: Array<{ action: string; duties: string[] }>;
  prohibitions: string[];
}

function extractBracketGroups(s: string): string[] {
  const groups: string[] = [];
  let depth = 0, start = -1, inStr = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"' && s[i - 1] !== '\\') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '[') { if (depth === 0) start = i; depth++; }
    else if (ch === ']') { depth--; if (depth === 0 && start >= 0) { groups.push(s.slice(start + 1, i)); start = -1; } }
  }
  return groups;
}

function parseRuleBlock(
  block: string,
  resolveTerm: (t: string) => string,
): { actions: string[]; duties: string[] } {
  const actions: string[] = [];
  const dutyBlocks: string[] = [];
  for (const seg of splitTopLevel(block, ';').map((s) => s.trim()).filter(Boolean)) {
    const m = seg.match(/^(\S+)\s+([\s\S]*)$/);
    if (!m) continue;
    const pred = resolveTerm(m[1]);
    if (pred === ODRL + 'action') {
      for (const o of splitTopLevel(m[2], ',')) {
        const t = resolveTerm(o.trim());
        if (t && !t.startsWith('(')) actions.push(t);
      }
    } else if (pred === ODRL + 'duty') {
      dutyBlocks.push(...extractBracketGroups(m[2]));
    }
  }
  const duties = dutyBlocks.flatMap((b) => parseRuleBlock(b, resolveTerm).actions);
  return { actions, duties };
}

function parseLicenceTtl(ttl: string): LicenceRules | null {
  const normalized = normalizeTtl(ttl);
  const ctx = makePrefixCtx(normalized);
  const body = ttlBody(normalized);
  const permissions: Array<{ action: string; duties: string[] }> = [];
  const prohibitions: string[] = [];
  if (!body) return null;

  for (const stmt of splitTopLevel(body, '.')) {
    const segs = splitTopLevel(stmt, ';').map((s) => s.trim()).filter(Boolean);
    if (!segs.length) continue;
    const first = segs[0].match(/^(\S+)\s+([\s\S]*)$/);
    if (!first) continue;
    const rest = [first[2], ...segs.slice(1)];
    for (const seg of rest) {
      const m = seg.match(/^(\S+)\s+([\s\S]*)$/);
      if (!m) continue;
      const pred = ctx.resolveTerm(m[1]);
      if (pred !== ODRL + 'permission' && pred !== ODRL + 'prohibition') continue;
      for (const block of extractBracketGroups(m[2])) {
        const rule = parseRuleBlock(block, ctx.resolveTerm);
        if (pred === ODRL + 'permission') {
          for (const act of rule.actions) permissions.push({ action: act, duties: rule.duties });
        } else {
          prohibitions.push(...rule.actions);
        }
      }
    }
  }
  if (!permissions.length && !prohibitions.length) return null;
  return { permissions, prohibitions };
}

interface CorpusSummary {
  licences_fetched: number;
  licences_parsed: number;
  fetch_errors: number;
  implies_candidates: number;
  allows_candidates: number;
  min_support: number;
  error?: string;
}

// Corpus pass — reads the licence snapshot from the Knowledge Base repo.
function corpusPass(
  licences: Array<{ name: string; text: string }>,
  resolve: (iri: string) => string,
  minSupport: number,
  folder: string,
): { assertions: Assertion[]; summary: CorpusSummary } {
  const permDuty = new Map<string, Set<string>>();
  const prohibPerm = new Map<string, Set<string>>();
  let parsed = 0;
  for (const lic of licences) {
    let rules: LicenceRules | null = null;
    try { rules = parseLicenceTtl(lic.text); } catch { rules = null; }
    if (!rules) continue;
    parsed++;
    const perms = rules.permissions
      .map((p) => ({ action: resolve(p.action), duties: [...new Set(p.duties.map(resolve))] }))
      .filter((p) => p.action);
    const prohibs = [...new Set(rules.prohibitions.map(resolve).filter(Boolean))];
    for (const p of perms) {
      for (const d of p.duties) {
        if (!d || d === p.action) continue;
        const k = p.action + '|' + d;
        if (!permDuty.has(k)) permDuty.set(k, new Set());
        permDuty.get(k)!.add(lic.name);
      }
    }
    for (const pr of prohibs) {
      for (const p of perms) {
        if (pr === p.action) continue;
        const k = pr + '|' + p.action;
        if (!prohibPerm.has(k)) prohibPerm.set(k, new Set());
        prohibPerm.get(k)!.add(lic.name);
      }
    }
  }

  const assertions: Assertion[] = [];
  for (const [k, set] of permDuty) {
    if (set.size < minSupport) continue;
    const [a, d] = k.split('|');
    assertions.push({
      subject: a, relation: REL_IMPLIES, object: d,
      subjectRole: ROLE_PERMISSION, objectRole: ROLE_DUTY,
      derivation: 'Corpus',
      source: `DALICC licence corpus snapshot ${folder} (${parsed} licences)`,
      support: set.size,
      rationale: `Permission ${curieOf(a)} is accompanied by duty ${curieOf(d)} in ${set.size} of ${parsed} licences.`,
    });
  }
  for (const [k, set] of prohibPerm) {
    if (set.size < minSupport) continue;
    const [pr, p] = k.split('|');
    assertions.push({
      subject: pr, relation: REL_ALLOWS, object: p,
      subjectRole: ROLE_PROHIBITION, objectRole: ROLE_PERMISSION,
      derivation: 'Corpus',
      source: `DALICC licence corpus snapshot ${folder} (${parsed} licences)`,
      support: set.size,
      rationale: `Prohibition ${curieOf(pr)} co-exists with permission ${curieOf(p)} in ${set.size} of ${parsed} licences.`,
    });
  }

  return {
    assertions,
    summary: {
      licences_fetched: licences.length,
      licences_parsed: parsed,
      fetch_errors: 0,
      implies_candidates: permDuty.size,
      allows_candidates: prohibPerm.size,
      min_support: minSupport,
    },
  };
}

async function resolveActionsPath(base44: any, src: any): Promise<string> {
  let actionsPath = (src.actions_path as string) || '';
  if (!actionsPath) {
    const sourceFiles = await base44.asServiceRole.entities.ApiSourceFile.filter({ section: 'Actions' });
    actionsPath = sourceFiles[0]?.file_path || '.openrel/vocabs/openrel/actions.ttl';
  }
  return actionsPath;
}

interface Prepared {
  ttlText: string;
  actions: Map<string, ActionInfo>;
  dgTriples: Array<{ s: string; p: string; o: string }>;
  resolve: (iri: string) => string;
  dgError: string | null;
}

async function loadActionsAndResolve(
  ghHeaders: Record<string, string>,
  repo: string,
  branch: string,
  actionsPath: string,
  dgEnabled: boolean,
  dgRepo: string,
  dgBranch: string,
  dgPath: string,
): Promise<Prepared> {
  const rawRes = await fetchT(`https://raw.githubusercontent.com/${repo}/${branch}/${actionsPath}`, { headers: ghHeaders });
  if (!rawRes.ok) throw new Error(`Failed to fetch actions.ttl (${rawRes.status})`);
  const ttlText = await rawRes.text();
  const { actions } = parseActionsTtl(ttlText);
  if (!actions.size) throw new Error('No actions parsed from actions.ttl');
  const reverseMap = buildReverseMap(actions);
  const sameAsAdj = new Map<string, Set<string>>();
  const dgTriples: Array<{ s: string; p: string; o: string }> = [];
  let dgError: string | null = null;
  if (dgEnabled) {
    try {
      const dgRes = await fetchT(`https://raw.githubusercontent.com/${dgRepo}/${dgBranch}/${dgPath}`);
      if (!dgRes.ok) throw new Error(`fetch dg (${dgRes.status})`);
      const parsed = parseFlatTriples(await dgRes.text());
      dgTriples.push(...parsed.triples);
      for (const t of dgTriples) {
        if (t.p === OWL + 'sameAs') addSameAs(sameAsAdj, t.s, t.o);
      }
    } catch (e: any) {
      dgError = e?.message || String(e);
    }
  }
  const resolve = (iri: string) => resolveExternal(iri, reverseMap, sameAsAdj);
  return { ttlText, actions, dgTriples, resolve, dgError };
}

// ---------------------------------------------------------------------------
// Corpus fetch — ONE tarball request for the whole repository. Hundreds of
// individual file downloads are what caused the earlier hangs, so the repo
// tarball is downloaded once and the licence TTLs are extracted from it
// in memory.
// ---------------------------------------------------------------------------
function tarTextEntries(buf: Uint8Array): Array<{ name: string; text: string }> {
  const dec = new TextDecoder();
  const out: Array<{ name: string; text: string }> = [];
  let off = 0;
  let longName: string | null = null;
  while (off + 512 <= buf.length) {
    const h = buf.subarray(off, off + 512);
    if (h[0] === 0) break; // zero block: end of archive
    let size = 0;
    for (let i = 124; i < 136; i++) {
      const c = h[i];
      if (c === 32 || c === 0) continue; // space/NUL padding
      if (c < 48 || c > 55) { size = -1; break; }
      size = size * 8 + (c - 48);
    }
    if (size < 0) break;
    const type = String.fromCharCode(h[156] ?? 48);
    let name = dec.decode(h.subarray(0, 100)).replace(/\0[\s\S]*$/, '');
    const prefix = dec.decode(h.subarray(345, 500)).replace(/\0[\s\S]*$/, '');
    if (prefix) name = prefix + '/' + name;
    const dataStart = off + 512;
    const dataEnd = dataStart + size;
    if (type === 'L') {
      // GNU long name: the real path for the next entry
      longName = dec.decode(buf.subarray(dataStart, dataEnd)).replace(/\0[\s\S]*$/, '');
    } else if ((type === '0' || type === '\0') && size > 0) {
      if (longName) { name = longName; longName = null; }
      out.push({ name, text: dec.decode(buf.subarray(dataStart, dataEnd)) });
    } else {
      longName = null;
    }
    off = dataStart + Math.ceil(size / 512) * 512;
  }
  return out;
}

async function fetchDaliccLicences(
  repo: string,
  branch: string,
  folder: string,
  headers: Record<string, string>,
): Promise<{ files: Array<{ name: string; text: string }>; errors: number; error?: string }> {
  const tarRes = await fetchT(`https://api.github.com/repos/${repo}/tarball/${branch}`, { headers }, 60000);
  if (!tarRes.ok) return { files: [], errors: 0, error: `repo tarball (${tarRes.status})` };
  try {
    const gz = tarRes.body!.pipeThrough(new DecompressionStream('gzip'));
    const buf = new Uint8Array(await new Response(gz).arrayBuffer());
    const marker = '/' + folder.replace(/^\/+|\/+$/g, '') + '/';
    const files = tarTextEntries(buf)
      .filter((f: { name: string }) => f.name.includes(marker) && f.name.endsWith('.ttl'))
      .map((f: { name: string; text: string }) => ({
        name: f.name.split(marker).pop() || f.name,
        text: f.text,
      }));
    if (!files.length) return { files: [], errors: 0, error: `no .ttl files under ${folder}` };
    return { files, errors: 0 };
  } catch (e: any) {
    return { files: [], errors: 0, error: `tarball extract: ${e?.message || String(e)}` };
  }
}

// ---------------------------------------------------------------------------
// LLM probabilistic pass
// ---------------------------------------------------------------------------
async function llmPass(
  base44: any,
  actions: Map<string, ActionInfo>,
  model: string,
  skip: boolean,
): Promise<Assertion[]> {
  if (skip || !actions.size) return [];
  const list = [...actions.values()];
  const chunkSize = 8;
  const chunks: ActionInfo[][] = [];
  for (let i = 0; i < list.length; i += chunkSize) chunks.push(list.slice(i, i + chunkSize));

  const vocab = [...actions.values()].map((a) => `${a.curie} (${a.label || curieOf(a.iri)})`).join('\n');
  const relations = ['includedIn', 'contradicts', 'implies'];
  const roleMap: Record<string, string> = {
    Permission: ROLE_PERMISSION,
    Prohibition: ROLE_PROHIBITION,
    Duty: ROLE_DUTY,
  };

  const results: Assertion[] = [];
  const batch = chunks.map(async (chunk) => {
    const perAction = chunk.map((a) => {
      const ctx = [
        `Action: ${a.curie}`,
        a.label ? `Label: ${a.label}` : '',
        a.definition ? `Definition: ${a.definition}` : '',
        a.categories.length ? `Categories: ${a.categories.map((c) => curieOf(c)).join(', ')}` : '',
        a.includedIn.length ? `Already includedIn: ${a.includedIn.map(curieOf).join(', ')}` : '',
        a.defaultDuty.length ? `Already implies(duty): ${a.defaultDuty.map(curieOf).join(', ')}` : '',
        a.contradicts.length ? `Already contradicts: ${a.contradicts.map(curieOf).join(', ')}` : '',
      ].filter(Boolean).join('\n');
      return ctx;
    }).join('\n\n');

    const prompt = `You are drafting a compatibility graph for an OpenREL policy wizard.
For each action below, propose relations to OTHER actions from the vocabulary.
Only propose relations that are NOT already stated. Use ONLY these relation names:
${relations.join(', ')}

Rules:
- includedIn: this action is a sub-case of the target (target is broader).
- contradicts: the two actions cannot coexist in the same rule (non-hierarchical conflict).
- implies: selecting this action (as a Permission) typically implies the target as a Duty.
- role: null for includedIn and contradicts; "Duty" for implies; otherwise null.
- Be conservative: only propose a contradicts/implies if it is genuinely sensible.
- object MUST be the CURIE of an action from the vocabulary list.
- confidence: 0.0–1.0.

Vocabulary (use these CURIEs as object):
${vocab}

Actions to draft:
${perAction}

Return JSON: { "assertions": [ { "subject": "openrel:...", "relation": "includedIn|contradicts|implies", "object": "openrel:...", "role": null|"Duty", "confidence": 0.7, "rationale": "..." } ] }`;

    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        model,
        response_json_schema: {
          type: 'object',
          properties: {
            assertions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  subject: { type: 'string' },
                  relation: { type: 'string' },
                  object: { type: 'string' },
                  role: { type: 'string' },
                  confidence: { type: 'number' },
                  rationale: { type: 'string' },
                },
              },
            },
          },
          required: ['assertions'],
        },
      });
      const data = (res as any)?.data ?? res;
      const arr = (data?.assertions || []) as any[];
      for (const r of arr) {
        const rel = relations.includes(r.relation) ? OPENREL + r.relation : null;
        if (!rel) continue;
        const subjIri = actions.has(r.subject) ? r.subject : null;
        const objIri = actions.has(r.object) ? r.object : null;
        if (!subjIri || !objIri) continue;
        const objectRole = r.role && roleMap[r.role] ? roleMap[r.role] : null;
        results.push({
          subject: subjIri, relation: rel, object: objIri,
          subjectRole: null, objectRole,
          derivation: 'Probabilistic', source: `LLM draft (${model})`,
          confidence: typeof r.confidence === 'number' ? r.confidence : 0.5,
          rationale: String(r.rationale || '').slice(0, 300),
        });
      }
    } catch (e: any) {
      console.warn('reasonerUpdate LLM chunk failed:', e?.message || e);
    }
  });
  await Promise.all(batch);
  return dedupByKey(results);
}

// ---------------------------------------------------------------------------
// Existing-graph preservation parse (our own reified format; legacy role → objectRole)
// ---------------------------------------------------------------------------
function parseExistingGraph(ttl: string): Assertion[] {
  if (!ttl) return [];
  const out: Assertion[] = [];
  const blocks = ttl.split(/\n(?=reasoner:assertion-)/);
  for (const b of blocks) {
    if (!b.includes('openrel:Assertion')) continue;
    const g = (re: RegExp): string | null => { const m = b.match(re); return m ? m[1] : null; };
    const subj = g(/openrel:subject\s+(openrel:[^\s;]+|odrl:[^\s;]+|cc:[^\s;]+|dalicc:[^\s;]+|<[^>]+>)/);
    const rel = g(/openrel:relation\s+(openrel:[^\s;]+)/);
    const obj = g(/openrel:object\s+(openrel:[^\s;]+|odrl:[^\s;]+|cc:[^\s;]+|dalicc:[^\s;]+|<[^>]+>)/);
    const srole = g(/openrel:subjectRole\s+(odrl:[^\s;]+)/);
    const orole = g(/openrel:objectRole\s+(odrl:[^\s;]+)/);
    const legacyRole = g(/openrel:role\s+(odrl:[^\s;]+)/);
    const deriv = g(/openrel:derivationType\s+openrel:(Deterministic|Corpus|Probabilistic)/);
    const source = g(/dct:source\s+"((?:[^"\\]|\\.)*)"/);
    const conf = g(/openrel:confidence\s+([0-9.]+)/);
    const rat = g(/openrel:rationale\s+"((?:[^"\\]|\\.)*)"/);
    const sup = g(/openrel:support\s+([0-9]+)/);
    if (!subj || !rel || !obj || !deriv) continue;
    const expand = (c: string) => {
      if (c.startsWith('<') && c.endsWith('>')) return c.slice(1, -1);
      if (c.startsWith('openrel:')) return OPENREL + c.substring(8);
      if (c.startsWith('odrl:')) return ODRL + c.substring(5);
      if (c.startsWith('cc:')) return CC + c.substring(3);
      if (c.startsWith('dalicc:')) return DALICC + c.substring(7);
      return c;
    };
    out.push({
      subject: expand(subj), relation: expand(rel), object: expand(obj),
      subjectRole: srole ? expand(srole) : null,
      objectRole: (orole ? expand(orole) : null) || (legacyRole ? expand(legacyRole) : null),
      derivation: deriv as Derivation,
      source: source ? source.replace(/\\"/g, '"') : '',
      confidence: conf ? parseFloat(conf) : undefined,
      rationale: rat ? rat.replace(/\\"/g, '"') : undefined,
      support: sup ? parseInt(sup, 10) : undefined,
    });
  }
  return out;
}

// Fetch + parse the existing graph (for preservation).
async function fetchExistingGraph(
  repo: string,
  branch: string,
  ghHeaders: Record<string, string>,
): Promise<Assertion[]> {
  try {
    const exRes = await fetchT(
      `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(GRAPH_FILE)}?ref=${branch}`,
      { headers: ghHeaders },
    );
    if (!exRes.ok) return [];
    const exJson = await exRes.json();
    if (!exJson.content) return [];
    const raw = decodeURIComponent(escape(atob(exJson.content.replace(/\n/g, ''))));
    return parseExistingGraph(raw);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------
function ttlString(s: string): string {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
}

function serializeGraph(assertions: Assertion[], generatedAt: string): string {
  const detCount = assertions.filter((a) => a.derivation === 'Deterministic').length;
  const corpusCount = assertions.filter((a) => a.derivation === 'Corpus').length;
  const probCount = assertions.filter((a) => a.derivation === 'Probabilistic').length;

  const lines: string[] = [];
  lines.push('# -------------------------------------------------------------------------------------------------------------');
  lines.push('# OpenREL Reasoner Graph');
  lines.push('# Auto-generated by reasonerUpdate. Editable: human-authored assertions');
  lines.push('# (dct:source "manual") are preserved across re-runs; reviewed probabilistic assertions survive too.');
  lines.push('# Merge rule: Deterministic > Corpus > Probabilistic — a weaker tier is dropped when a');
  lines.push('# stronger one asserts the same edge (subject | relation | object | roles).');
  lines.push('# Sources: actions.ttl (deterministic) · DALICC dependency graph (deterministic) ·');
  lines.push('# DALICC licence corpus (statistical, openrel:support = licence count) · LLM drafts (probabilistic).');
  lines.push('# -------------------------------------------------------------------------------------------------------------');
  lines.push('@prefix openrel: <http://www.w3.org/ns/openrel/0/> .');
  lines.push('@prefix odrl: <http://www.w3.org/ns/odrl/2/> .');
  lines.push('@prefix cc: <http://creativecommons.org/ns#> .');
  lines.push('@prefix dalicc: <https://dalicc.net/ns#> .');
  lines.push('@prefix dct: <http://purl.org/dc/terms/> .');
  lines.push('@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .');
  lines.push('@prefix reasoner: <http://www.w3.org/ns/openrel/0/reasoner/> .');
  lines.push('');
  lines.push(`reasoner:graph a openrel:ReasonerGraph ;`);
  lines.push(`  dct:title "OpenREL Reasoner Graph"@en ;`);
  lines.push(`  dct:modified "${generatedAt}"^^xsd:dateTime ;`);
  lines.push(`  openrel:deterministicCount ${detCount} ;`);
  lines.push(`  openrel:corpusCount ${corpusCount} ;`);
  lines.push(`  openrel:probabilisticCount ${probCount} .`);
  lines.push('');

  assertions.forEach((a, i) => {
    const id = 'assertion-' + String(i + 1).padStart(4, '0');
    lines.push(`reasoner:${id}`);
    lines.push(`  a openrel:Assertion ;`);
    lines.push(`  openrel:subject ${curieOf(a.subject)} ;`);
    lines.push(`  openrel:relation ${curieOf(a.relation)} ;`);
    lines.push(`  openrel:object ${curieOf(a.object)} ;`);
    if (a.subjectRole) lines.push(`  openrel:subjectRole ${curieOf(a.subjectRole)} ;`);
    if (a.objectRole) lines.push(`  openrel:objectRole ${curieOf(a.objectRole)} ;`);
    lines.push(`  openrel:derivationType openrel:${a.derivation} ;`);
    if (a.derivation === 'Corpus' && typeof a.support === 'number') {
      lines.push(`  openrel:support ${a.support} ;`);
    }
    if (a.derivation === 'Probabilistic' && typeof a.confidence === 'number') {
      lines.push(`  openrel:confidence ${a.confidence.toFixed(2)} ;`);
    }
    if (a.rationale) lines.push(`  openrel:rationale ${ttlString(a.rationale)} ;`);
    lines.push(`  dct:source ${ttlString(a.source)} ;`);
    lines.push(`  dct:modified "${generatedAt}"^^xsd:dateTime .`);
    lines.push('');
  });
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Vocabulary authoring — openrel:allows into actions.ttl (idempotent)
// ---------------------------------------------------------------------------
function ensureAllowsDefinition(actionsTtl: string): string | null {
  if (/openrel:allows\b/.test(actionsTtl)) return null;
  const today = new Date().toISOString().slice(0, 10);
  return actionsTtl.replace(/\s*$/, '') + `

# -------------------------------------------------------------------------------------------------------------
# openrel:allows — directional co-existence relation for the Reasoner Graph (authored ${today}).
# A Prohibition of the subject action allows a Permission of the object action within the same
# policy, as attested by licence corpus evidence (DALICC).
# -------------------------------------------------------------------------------------------------------------
openrel:allows a skos:Concept ;
    skos:prefLabel "allows"@en ;
    skos:definition "Indicates that a prohibition on the subject action can co-exist with a permission on the object action within the same policy."@en ;
    skos:scopeNote "One of the OpenREL type_evaluation relations used by the Reasoner Graph."@en .
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default async function reasonerUpdate(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    let user: { role?: string } | null = null;
    try { user = await base44.auth.me(); } catch { user = null; }
    const body = await req.json().catch(() => ({}));
    const dryRun = !!body.dry_run;
    const skipLlm = !!body.skip_llm;
    const model = (body.model as string) || 'gemini_3_flash';
    const message = body.message || 'Update OpenREL Reasoner Graph (actions, DALICC sources, corpus evidence)';

    const isAdmin = !!user && /admin/i.test(user.role || '');
    if (!dryRun && user && !isAdmin) {
      return Response.json({ error: 'Admin role required to apply reasoner update' }, { status: 403 });
    }

    // Source configuration (UI-supplied, with defaults).
    const src = body.sources || {};
    const dgEnabled = src.dg_enabled !== false;
    const dgRepo = (src.dg_repo as string) || 'dalicc/dalicc';
    const dgBranch = (src.dg_branch as string) || 'main';
    const dgPath = (src.dg_path as string) || 'licensedata/dependencygraph/dg_default.ttl';
    const corpusEnabled = src.corpus_enabled !== false;
    const corpusFolder = ((src.corpus_folder as string) || 'data/input/dalicc').replace(/^\/+|\/+$/g, '');
    const minSupport = Number(src.corpus_min_support) || 2;

    const creds = await resolveGithubCredentials(base44, {});
    const { token, githubRepo: repo, branch } = creds;
    if (!token || !repo) {
      return Response.json({ error: 'GitHub credentials not configured' }, { status: 500 });
    }
    const ghHeaders = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'OpenREL-App',
    };
    const warnings: string[] = [];

    // 1. Locate actions.ttl (UI path override → API configuration → default).
    const actionsPath = await resolveActionsPath(base44, src);

    // 2. Actions + DALICC dependency graph (shared loader).
    const prep = await loadActionsAndResolve(ghHeaders, repo, branch, actionsPath, dgEnabled, dgRepo, dgBranch, dgPath);
    const { ttlText, actions, resolve } = prep;

    // 3. DALICC dependency graph edges (deterministic tier).
    const dgAssertions: Assertion[] = [];
    const dgSummary: any = { enabled: dgEnabled, edges: 0, same_as: 0, unresolved: 0, error: prep.dgError };
    if (dgEnabled) {
      if (prep.dgError) warnings.push(`Dependency graph skipped: ${prep.dgError}`);
      for (const t of prep.dgTriples) {
        if (t.p === OWL + 'sameAs') { dgSummary.same_as++; continue; }
        let rel: string | null = null;
        let objectRole: string | null = null;
        let relName = '';
        if (t.p === ODRL + 'includedIn') { rel = REL_INCLUDEDIN; relName = 'odrl:includedIn'; }
        else if (t.p === ODRL + 'implies') { rel = REL_IMPLIES; objectRole = ROLE_DUTY; relName = 'odrl:implies'; }
        else if (t.p === DALICC + 'contradicts') { rel = REL_CONTRADICTS; relName = 'dalicc:contradicts'; }
        if (!rel) continue;
        dgSummary.edges++;
        const s = resolve(t.s);
        const o = resolve(t.o);
        if (s === o) continue;
        if (!s.startsWith(OPENREL) || !o.startsWith(OPENREL)) dgSummary.unresolved++;
        dgAssertions.push({
          subject: s, relation: rel, object: o,
          subjectRole: null, objectRole,
          derivation: 'Deterministic',
          source: `DALICC dependency graph (${relName})`,
        });
      }
    }

    // 4. Corpus tier — licence snapshot from the Knowledge Base repo.
    const corpusSummary: CorpusSummary = {
      licences_fetched: 0,
      licences_parsed: 0,
      fetch_errors: 0,
      implies_candidates: 0,
      allows_candidates: 0,
      min_support: minSupport,
    };
    let corpusAssertions: Assertion[] = [];
    if (corpusEnabled) {
      try {
        const { files: allFiles, errors, error } = await fetchDaliccLicences(repo, branch, corpusFolder, ghHeaders);
        if (error) throw new Error(error);
        const corpusLimit = Number(src.corpus_limit) || 0;
        const files = corpusLimit > 0 ? allFiles.slice(0, corpusLimit) : allFiles;
        corpusSummary.fetch_errors = errors;
        if (errors) warnings.push(`${errors} licence file(s) could not be fetched`);
        const res = corpusPass(files, resolve, minSupport, corpusFolder);
        corpusAssertions = res.assertions;
        Object.assign(corpusSummary, res.summary);
      } catch (e: any) {
        corpusSummary.error = e?.message || String(e);
        warnings.push(`Licence corpus skipped: ${corpusSummary.error}`);
      }
    }

    // 5. Deterministic tier (actions.ttl + dg), with manual preservation.
    const existing: Assertion[] = await fetchExistingGraph(repo, branch, ghHeaders);
    const detFromSource = dedupByKey([...deterministicPass(actions), ...dgAssertions]);
    const manualDetAll = existing.filter(
      (a) => a.derivation === 'Deterministic' && /manual|curated/i.test(a.source),
    );
    const det = dedupByKey([...detFromSource, ...manualDetAll]);
    const detKeys = new Set(det.map(edgeKey));

    // 6. Corpus tier (shadowed by deterministic), with manual preservation.
    const corpusRegen = corpusAssertions.filter((a) => !detKeys.has(edgeKey(a)));
    const manualCorpus = existing.filter(
      (a) => a.derivation === 'Corpus' && /manual|curated/i.test(a.source),
    ).filter((a) => !detKeys.has(edgeKey(a)));
    const corpus = dedupByKey([...corpusRegen, ...manualCorpus]);
    const corpusKeys = new Set(corpus.map(edgeKey));

    // 7. Probabilistic tier (LLM + preserved), shadowed by det/corpus.
    const llm = await llmPass(base44, actions, model, skipLlm);
    const preservedProb = existing.filter((a) => a.derivation === 'Probabilistic');
    const probAll = dedupByKey([...preservedProb, ...llm]);
    const prob = probAll.filter((a) => !detKeys.has(edgeKey(a)) && !corpusKeys.has(edgeKey(a)));
    const dropped = probAll.length - prob.length;

    const llmKeys = new Set(llm.map(edgeKey));
    const probabilisticNew = prob.filter((a) => llmKeys.has(edgeKey(a))).length;

    const merged = dedupSorted([...det, ...corpus, ...prob]);

    const summary = {
      actions_parsed: actions.size,
      deterministic_count: det.length,
      deterministic_new: detFromSource.length,
      deterministic_preserved_manual: det.length - detFromSource.length,
      corpus_count: corpus.length,
      corpus_new: corpusRegen.length,
      corpus_preserved_manual: corpus.length - corpusRegen.length,
      probabilistic_count: prob.length,
      probabilistic_new: probabilisticNew,
      probabilistic_preserved: prob.length - probabilisticNew,
      probabilistic_dropped_shadowed: Math.max(0, dropped),
      llm_skipped: skipLlm,
      model,
      dg_summary: dgSummary,
      corpus_summary: corpusSummary,
      warnings,
    };

    if (dryRun) {
      const assertionsOut = merged.map((a) => ({
        subject: a.subject, relation: a.relation, object: a.object,
        subjectRole: a.subjectRole, objectRole: a.objectRole,
        derivation: a.derivation,
        confidence: a.confidence, rationale: a.rationale, source: a.source,
        support: a.support,
      }));
      return Response.json({ dry_run: true, ...summary, assertions: assertionsOut, total: merged.length });
    }

    // 8. Apply — serialize + PR (graph +, when needed, openrel:allows in actions.ttl).
    let toCommit = merged;
    if (Array.isArray(body.curated_assertions) && body.curated_assertions.length) {
      toCommit = (body.curated_assertions as any[]).map((a) => ({
        subject: a.subject, relation: a.relation, object: a.object,
        subjectRole: a.subjectRole || null,
        objectRole: a.objectRole || null,
        derivation: (['Deterministic', 'Corpus', 'Probabilistic'] as const).includes(a.derivation)
          ? a.derivation : 'Deterministic',
        source: a.source || 'curated (UI)',
        confidence: a.confidence, rationale: a.rationale, support: a.support,
      }));
      toCommit = dedupSorted(toCommit);
    }

    const generatedAt = new Date().toISOString();
    const serialized = serializeGraph(toCommit, generatedAt);

    const extraFiles: Array<{ path: string; content: string }> = [];
    const allowsActionsTtl = ensureAllowsDefinition(ttlText);
    if (allowsActionsTtl) extraFiles.push({ path: actionsPath, content: allowsActionsTtl });

    let prResult: { pr_url: string; pr_number: number; branch: string };
    try {
      prResult = await submitGithubPR({
        token, repo, branch,
        filePath: GRAPH_FILE,
        content: serialized,
        message,
        prTitle: 'Update OpenREL Reasoner Graph',
        branchPrefix: 'reasoner-update',
        extra_files: extraFiles.length ? extraFiles : undefined,
      });
    } catch (e: any) {
      return Response.json({ error: `submitGithubPR failed: ${e?.message || String(e)}` }, { status: 500 });
    }

    return Response.json({
      dry_run: false,
      ...summary,
      total: toCommit.length,
      vocabulary_updated: extraFiles.length > 0,
      pr_url: prResult.pr_url,
      pr_number: prResult.pr_number,
      branch: prResult.branch,
    });
  } catch (error) {
    return Response.json({ error: (error as any).message }, { status: 500 });
  }
}