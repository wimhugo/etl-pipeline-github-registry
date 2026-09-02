import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveGithubCredentials } from '../../shared/resolveGithubCredentials.ts';
import { submitGithubPR } from '../../shared/submitGithubPR.ts';

/**
 * ReasonerUpdate
 * --------------
 * Builds the OpenREL Reasoner Graph (data/reasoner/graph_reasoner.ttl) — a
 * reified, human-editable graph of assertions between actions (and, later,
 * constraints) using the five type_evaluation relations:
 *   openrel:includedIn · openrel:contradicts · openrel:implies ·
 *   openrel:compatible · openrel:missing
 *
 * Assertions are produced in two tiers:
 *   - Deterministic  — derived mechanically from actions.ttl:
 *       · odrl:includedIn edges (verbatim)
 *       · includedIn propagated via skos:exactMatch / broadMatch / narrowMatch
 *       · openrel:defaultDuty  → implies
 *       · openrel:contradicts   → contradicts (authored)
 *   - Probabilistic  — LLM-draft edges (contradicts / implies / includedIn
 *     gaps) with confidence + rationale, for human review.
 *
 * Merge rule: a probabilistic assertion whose edge key already exists as a
 * deterministic assertion is dropped ("ignore probabilistic if a deterministic
 * one is already present").
 *
 * Preservation: re-runs regenerate every deterministic-from-source edge, but
 * PRESERVE:
 *   - existing human-authored deterministic assertions (dct:source "manual")
 *   - existing probabilistic assertions (so curator review of LLM drafts
 *     survives) — unless a new deterministic edge now shadows them.
 *
 * Output is a reified, commented, editable TTL file committed via a PR.
 *
 * Payload: { dry_run?: boolean, skip_llm?: boolean, model?: string, message?: string }
 */

const GRAPH_FILE = 'data/reasoner/graph_reasoner.ttl';
const OPENREL = 'http://www.w3.org/ns/openrel/0/';
const ODRL = 'http://www.w3.org/ns/odrl/2/';
const SKOS = 'http://www.w3.org/2004/02/skos/core#';
const DCT = 'http://purl.org/dc/terms/';
const XSD = 'http://www.w3.org/2001/XMLSchema#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

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

interface Assertion {
  subject: string;
  relation: string;   // openrel:includedIn | openrel:contradicts | openrel:implies
  object: string;
  role: string | null;
  derivation: 'Deterministic' | 'Probabilistic';
  source: string;
  confidence?: number;
  rationale?: string;
}

const REL_INCLUDEDIN = OPENREL + 'includedIn';
const REL_CONTRADICTS = OPENREL + 'contradicts';
const REL_IMPLIES = OPENREL + 'implies';

function curieOf(iri: string): string {
  if (iri.startsWith(OPENREL)) return 'openrel:' + iri.substring(OPENREL.length);
  if (iri.startsWith(ODRL)) return 'odrl:' + iri.substring(ODRL.length);
  if (iri.startsWith(SKOS)) return 'skos:' + iri.substring(SKOS.length);
  if (iri.startsWith(DCT)) return 'dct:' + iri.substring(DCT.length);
  return iri;
}

// ---------------------------------------------------------------------------
// Flat Turtle parser — sufficient for actions.ttl (flat predicate-object
// statements; no blank-node rule blocks). Mirrors the normalization used by
// the policy extractor (append '.' to bare @prefix/@base; escape stray
// inner quotes) but returns a per-subject predicate→objects map.
// ---------------------------------------------------------------------------
function normalizeTtl(ttl: string): string {
  return ttl.split('\n').map((line) => {
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
    if (depth === 0 && ch === delim) { parts.push(buf.slice(0, -1)); buf = ''; }
  }
  if (buf.trim()) parts.push(buf);
  return parts;
}

function parseActionsTtl(ttl: string): { actions: Map<string, ActionInfo>; prefixes: Record<string, string> } {
  const normalized = normalizeTtl(ttl);
  const prefixes: Record<string, string> = {};
  let pm: RegExpExecArray | null;
  const prefixRe = /@prefix\s+([^:\s]+):\s+<([^>]+)>\s*\./g;
  while ((pm = prefixRe.exec(normalized)) !== null) prefixes[pm[1].trim()] = pm[2];
  const baseMatch = normalized.match(/@base\s+<([^>]+)>\s*\./);
  const baseIri = baseMatch ? baseMatch[1] : null;

  function resolveTerm(term: string): string {
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
  }

  let body = stripComments(normalized.replace(/@prefix[^\n]*\n?/g, '').replace(/@base[^\n]*\n?/g, ''));
  body = body.replace(/\s+/g, ' ').trim();
  if (!body) return { actions: new Map(), prefixes };

  const actions = new Map<string, ActionInfo>();
  const ACTION_CLASS = new Set([ODRL + 'Action', OPENREL + 'Action']);

  for (const stmt of splitTopLevel(body, '.')) {
    const segs = splitTopLevel(stmt, ';').map((s) => s.trim()).filter(Boolean);
    if (!segs.length) continue;
    const first = segs[0].match(/^(\S+)\s+(.*)/);
    if (!first) continue;
    const subjectIri = resolveTerm(first[1]);
    const segRest = [first[2], ...segs.slice(1)];
    const props: Record<string, string[]> = {};
    for (const seg of segRest) {
      const m = seg.match(/^(\S+)\s+(.*)/);
      if (!m) continue;
      const pred = resolveTerm(m[1]);
      const objs = splitTopLevel(m[2], ',').map((o) => o.trim()).filter(Boolean);
      for (const o of objs) {
        if (!props[pred]) props[pred] = [];
        props[pred].push(o);
      }
    }
    const types = (props[RDF_TYPE] || []).map(resolveTerm);
    if (!types.some((t) => ACTION_CLASS.has(t))) continue;

    const lit = (iri: string): string => {
      const v = props[iri]?.[0] || '';
      const m = v.match(/^"((?:[^"\\]|\\.)*)"/);
      return m ? m[1].replace(/\\"/g, '"') : '';
    };
    const iris = (iri: string): string[] => (props[iri] || [])
      .filter((o) => !o.startsWith('"'))
      .map(resolveTerm);

    const info: ActionInfo = {
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
    };
    actions.set(subjectIri, info);
  }
  return { actions, prefixes };
}

// ---------------------------------------------------------------------------
// Deterministic assertion generation
// ---------------------------------------------------------------------------
function edgeKey(a: Pick<Assertion, 'subject' | 'relation' | 'object' | 'role'>): string {
  return [a.subject, a.relation, a.object, a.role || ''].join('|');
}

function deterministicPass(actions: Map<string, ActionInfo>): Assertion[] {
  const out: Assertion[] = [];
  const push = (s: string, rel: string, o: string, role: string | null, source: string) =>
    out.push({ subject: s, relation: rel, object: o, role, derivation: 'Deterministic', source });

  // Reverse lookup: odrl action → openrel action that exactMatches it.
  const odrlToOpenrel = new Map<string, string>();
  for (const a of actions.values()) {
    for (const em of a.exactMatch) {
      if (em.startsWith(ODRL) && a.iri.startsWith(OPENREL)) odrlToOpenrel.set(em, a.iri);
    }
  }
  const resolveTarget = (iri: string): string => odrlToOpenrel.get(iri) || iri;

  for (const a of actions.values()) {
    // 1. Verbatim includedIn
    for (const inc of a.includedIn) {
      push(a.iri, REL_INCLUDEDIN, resolveTarget(inc), null, 'odrl:includedIn');
    }
    // 2. Propagate via skos mappings
    //    A exactMatch B, B includedIn C  ⇒  A includedIn C
    for (const em of a.exactMatch) {
      const b = actions.get(em);
      if (!b) continue;
      for (const c of b.includedIn) {
        push(a.iri, REL_INCLUDEDIN, resolveTarget(c), null, 'skos:exactMatch propagation');
      }
    }
    //    A broadMatch B  ⇒  B includedIn A   (A is the broader)
    for (const bm of a.broadMatch) {
      push(resolveTarget(bm), REL_INCLUDEDIN, a.iri, null, 'skos:broadMatch propagation');
    }
    //    A narrowMatch B ⇒  A includedIn B   (B is the broader)
    for (const nm of a.narrowMatch) {
      push(a.iri, REL_INCLUDEDIN, resolveTarget(nm), null, 'skos:narrowMatch propagation');
    }
    // 3. defaultDuty → implies (role Duty)
    for (const d of a.defaultDuty) {
      push(a.iri, REL_IMPLIES, resolveTarget(d), ODRL + 'Duty', 'openrel:defaultDuty');
    }
    // 4. authored contradicts
    for (const c of a.contradicts) {
      push(a.iri, REL_CONTRADICTS, resolveTarget(c), null, 'authored (openrel:contradicts)');
    }
  }
  // Dedup deterministic (same key → keep first)
  const seen = new Set<string>();
  return out.filter((a) => { const k = edgeKey(a); if (seen.has(k)) return false; seen.add(k); return true; });
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
  const roles = ['Permission', 'Prohibition', 'Duty'];

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
        const role = r.role && roles.includes(r.role) ? ODRL + r.role : null;
        results.push({
          subject: subjIri, relation: rel, object: objIri, role,
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
  // Dedup within the LLM batch (same edge key → keep first).
  const seen = new Set<string>();
  return results.filter((a) => { const k = edgeKey(a); if (seen.has(k)) return false; seen.add(k); return true; });
}

// ---------------------------------------------------------------------------
// Existing-graph preservation parse (our own reified format)
// ---------------------------------------------------------------------------
function parseExistingGraph(ttl: string): Assertion[] {
  if (!ttl) return [];
  const out: Assertion[] = [];
  const blocks = ttl.split(/\n(?=reasoner:assertion-)/);
  for (const b of blocks) {
    if (!b.includes('openrel:Assertion')) continue;
    const g = (re: RegExp): string | null => { const m = b.match(re); return m ? m[1] : null; };
    const subj = g(/openrel:subject\s+(openrel:[^\s;]+|odrl:[^\s;]+|<[^>]+>)/);
    const rel = g(/openrel:relation\s+(openrel:[^\s;]+)/);
    const obj = g(/openrel:object\s+(openrel:[^\s;]+|odrl:[^\s;]+|<[^>]+>)/);
    const role = g(/openrel:role\s+(odrl:[^\s;]+)/);
    const deriv = g(/openrel:derivationType\s+openrel:(Deterministic|Probabilistic)/);
    const source = g(/dct:source\s+"((?:[^"\\]|\\.)*)"/);
    const conf = g(/openrel:confidence\s+([0-9.]+)/);
    const rat = g(/openrel:rationale\s+"((?:[^"\\]|\\.)*)"/);
    if (!subj || !rel || !obj || !deriv) continue;
    const expand = (c: string) => {
      if (c.startsWith('<') && c.endsWith('>')) return c.slice(1, -1);
      if (c.startsWith('openrel:')) return OPENREL + c.substring(8);
      if (c.startsWith('odrl:')) return ODRL + c.substring(5);
      return c;
    };
    out.push({
      subject: expand(subj), relation: expand(rel), object: expand(obj),
      role: role ? ODRL + role.substring(5) : null,
      derivation: deriv as 'Deterministic' | 'Probabilistic',
      source: source ? source.replace(/\\"/g, '"') : '',
      confidence: conf ? parseFloat(conf) : undefined,
      rationale: rat ? rat.replace(/\\"/g, '"') : undefined,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------
function ttlString(s: string): string {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
}

function serializeGraph(assertions: Assertion[], generatedAt: string): string {
  const relOrder = [REL_INCLUDEDIN, REL_CONTRADICTS, REL_IMPLIES];
  const sorted = [...assertions].sort((a, b) => {
    const dr = (a.derivation === 'Deterministic' ? 0 : 1) - (b.derivation === 'Deterministic' ? 0 : 1);
    if (dr) return dr;
    const rr = relOrder.indexOf(a.relation) - relOrder.indexOf(b.relation);
    if (rr) return rr;
    return curieOf(a.subject).localeCompare(curieOf(b.subject));
  });

  const lines: string[] = [];
  lines.push('# -------------------------------------------------------------------------------------------------------------');
  lines.push('# OpenREL Reasoner Graph');
  lines.push('# Auto-generated by reasonerUpdate. Editable: human-authored deterministic assertions');
  lines.push('# (dct:source "manual") and reviewed probabilistic assertions are preserved across re-runs.');
  lines.push('# Merge rule: probabilistic assertions are dropped where a deterministic edge already exists.');
  lines.push('# -------------------------------------------------------------------------------------------------------------');
  lines.push('@prefix openrel: <http://www.w3.org/ns/openrel/0/> .');
  lines.push('@prefix odrl: <http://www.w3.org/ns/odrl/2/> .');
  lines.push('@prefix dct: <http://purl.org/dc/terms/> .');
  lines.push('@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .');
  lines.push('@prefix reasoner: <http://www.w3.org/ns/openrel/0/reasoner/> .');
  lines.push('');
  lines.push(`reasoner:graph a openrel:ReasonerGraph ;`);
  lines.push(`  dct:title "OpenREL Reasoner Graph"@en ;`);
  lines.push(`  dct:modified "${generatedAt}"^^xsd:dateTime ;`);
  lines.push(`  openrel:deterministicCount ${assertions.filter((a) => a.derivation === 'Deterministic').length} ;`);
  lines.push(`  openrel:probabilisticCount ${assertions.filter((a) => a.derivation === 'Probabilistic').length} .`);
  lines.push('');

  sorted.forEach((a, i) => {
    const id = 'assertion-' + String(i + 1).padStart(4, '0');
    lines.push(`reasoner:${id}`);
    lines.push(`  a openrel:Assertion ;`);
    lines.push(`  openrel:subject ${curieOf(a.subject)} ;`);
    lines.push(`  openrel:relation ${curieOf(a.relation)} ;`);
    lines.push(`  openrel:object ${curieOf(a.object)} ;`);
    if (a.role) lines.push(`  openrel:role ${curieOf(a.role)} ;`);
    lines.push(`  openrel:derivationType openrel:${a.derivation} ;`);
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
    const message = body.message || 'Update OpenREL Reasoner Graph (action assertions)';

    const isAdmin = !!user && /admin/i.test(user.role || '');
    if (!dryRun && user && !isAdmin) {
      return Response.json({ error: 'Admin role required to apply reasoner update' }, { status: 403 });
    }

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

    // 1. Locate the Actions source file.
    const sourceFiles = await base44.asServiceRole.entities.ApiSourceFile.filter({ section: 'Actions' });
    const actionsPath = sourceFiles[0]?.file_path || '.openrel/vocabs/openrel/actions.ttl';

    // 2. Fetch raw actions.ttl.
    const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${actionsPath}`;
    const rawRes = await fetch(rawUrl, { headers: ghHeaders });
    if (!rawRes.ok) {
      return Response.json({ error: `Failed to fetch actions.ttl (${rawRes.status})` }, { status: 500 });
    }
    const ttlText = await rawRes.text();
    const { actions } = parseActionsTtl(ttlText);
    if (!actions.size) {
      return Response.json({ error: 'No actions parsed from actions.ttl' }, { status: 500 });
    }

    // 3. Deterministic pass.
    const det = deterministicPass(actions);

    // 4. Fetch + parse the existing graph (for preservation).
    let existing: Assertion[] = [];
    const exRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(GRAPH_FILE)}?ref=${branch}`,
      { headers: ghHeaders },
    );
    if (exRes.ok) {
      const exJson = await exRes.json();
      if (exJson.content) {
        const raw = decodeURIComponent(escape(atob(exJson.content.replace(/\n/g, ''))));
        existing = parseExistingGraph(raw);
      }
    }

    // 5. LLM probabilistic pass.
    const llm = await llmPass(base44, actions, model, skipLlm);

    // 6. Merge.
    const detKeys = new Set(det.map(edgeKey));
    const preservedManualDet = existing.filter((a) => a.derivation === 'Deterministic' && /manual/i.test(a.source));
    const preservedProb = existing.filter((a) => a.derivation === 'Probabilistic');
    const manualKeys = new Set(preservedManualDet.map(edgeKey));

    const finalDet = [...det, ...preservedManualDet.filter((a) => !detKeys.has(edgeKey(a)))];
    const finalDetKeys = new Set(finalDet.map(edgeKey));

    // New LLM probabilistic: drop if shadowed by deterministic OR already preserved.
    const preservedProbKeys = new Set(preservedProb.map(edgeKey));
    const newProb = llm.filter((a) => !finalDetKeys.has(edgeKey(a)) && !preservedProbKeys.has(edgeKey(a)));
    // Preserved probabilistic: drop if now shadowed by a new deterministic.
    const keptPreservedProb = preservedProb.filter((a) => !finalDetKeys.has(edgeKey(a)));
    const finalProb = [...keptPreservedProb, ...newProb];

    let merged = [...finalDet, ...finalProb];
    // Safety-net dedup across the whole graph (deterministic wins, since it
    // is first) + alphabetical sort so adjacent duplicates are visible to humans.
    {
      const seen = new Set<string>();
      merged = merged.filter((a) => { const k = edgeKey(a); if (seen.has(k)) return false; seen.add(k); return true; });
    }
    merged.sort((a, b) =>
      curieOf(a.subject).localeCompare(curieOf(b.subject)) ||
      curieOf(a.relation).localeCompare(curieOf(b.relation)) ||
      curieOf(a.object).localeCompare(curieOf(b.object)),
    );
    const droppedProbabilistic = (preservedProb.length + llm.length) - finalProb.length;

    const summary = {
      actions_parsed: actions.size,
      deterministic_count: finalDet.length,
      deterministic_new: det.length,
      deterministic_preserved_manual: preservedManualDet.length,
      probabilistic_count: finalProb.length,
      probabilistic_new: newProb.length,
      probabilistic_preserved: keptPreservedProb.length,
      probabilistic_dropped_shadowed: Math.max(0, droppedProbabilistic),
      llm_skipped: skipLlm,
      model,
    };

    if (dryRun) {
      // Return the full, deduped, alphabetically-sorted assertion list so the
      // UI can render an editable preview (delete / reverse per row) and send
      // the curated set back on apply.
      const assertions = merged.map((a) => ({
        subject: a.subject, relation: a.relation, object: a.object,
        role: a.role, derivation: a.derivation,
        confidence: a.confidence, rationale: a.rationale, source: a.source,
      }));
      return Response.json({ dry_run: true, ...summary, assertions, total: merged.length });
    }

    // 7. Apply — serialize + PR. If the UI sends a curated assertion list
    //    (post delete/reverse edits), commit that verbatim instead of the
    //    regenerated set, so preview curation persists.
    let toCommit = merged;
    if (Array.isArray(body.curated_assertions) && body.curated_assertions.length) {
      toCommit = (body.curated_assertions as any[]).map((a) => ({
        subject: a.subject, relation: a.relation, object: a.object,
        role: a.role || null,
        derivation: a.derivation === 'Probabilistic' ? 'Probabilistic' : 'Deterministic',
        source: a.source || 'curated (UI)',
        confidence: a.confidence, rationale: a.rationale,
      }));
      // Re-dedup + re-sort the curated set for a clean file.
      const seen = new Set<string>();
      toCommit = toCommit.filter((a) => { const k = edgeKey(a); if (seen.has(k)) return false; seen.add(k); return true; });
      toCommit.sort((a, b) =>
        curieOf(a.subject).localeCompare(curieOf(b.subject)) ||
        curieOf(a.relation).localeCompare(curieOf(b.relation)) ||
        curieOf(a.object).localeCompare(curieOf(b.object)),
      );
    }

    const generatedAt = new Date().toISOString();
    const serialized = serializeGraph(toCommit, generatedAt);

    let prResult: { pr_url: string; pr_number: number; branch: string };
    try {
      prResult = await submitGithubPR({
        token, repo, branch,
        filePath: GRAPH_FILE,
        content: serialized,
        message,
        prTitle: 'Update OpenREL Reasoner Graph',
        branchPrefix: 'reasoner-update',
      });
    } catch (e: any) {
      return Response.json({ error: `submitGithubPR failed: ${e?.message || String(e)}` }, { status: 500 });
    }

    return Response.json({ dry_run: false, ...summary, total: merged.length, pr_url: prResult.pr_url, pr_number: prResult.pr_number, branch: prResult.branch });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}