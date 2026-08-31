/**
 * odrlParser.js — Lossless ODRL Turtle parser (client-side, N3.js).
 *
 * N3.js is injected (dependency injection) so this module has zero imports and
 * can run in any context: a standalone HTML loading N3 from a CDN, or the
 * React app importing the `n3` npm package.
 *
 * Unlike the regex splitter in fetchApiSourceContent, this reconstructs the
 * nested permission / prohibition / duty / constraint structure exactly,
 * because it walks the real RDF triple graph produced by N3.js.
 */

const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDF_TYPE = RDF + 'type';
const ODRL = 'http://www.w3.org/ns/odrl/2/';
const OPENREL_NS = 'http://www.w3.org/ns/openrel/0/';
const DCT = 'http://purl.org/dc/terms/';
const SKOS = 'http://www.w3.org/2004/02/skos/core#';

const POLICY_TYPES = new Set([
  ODRL + 'Policy', ODRL + 'Set', ODRL + 'Offer', ODRL + 'Agreement',
  OPENREL_NS + 'Policy', OPENREL_NS + 'PolicyCollection',
  OPENREL_NS + 'Licence', OPENREL_NS + 'Access', OPENREL_NS + 'Process',
]);

/** Compact a full IRI to a CURIE for the namespaces used by OpenREL. */
export function compactOpenrel(iri) {
  if (typeof iri !== 'string') return iri;
  if (iri.startsWith(OPENREL_NS)) return 'openrel:' + iri.substring(OPENREL_NS.length);
  if (iri.startsWith(ODRL)) return 'odrl:' + iri.substring(ODRL.length);
  if (iri.startsWith(DCT)) return 'dct:' + iri.substring(DCT.length);
  if (iri.startsWith(SKOS)) return 'skos:' + iri.substring(SKOS.length);
  if (iri.startsWith(RDF)) return 'rdf:' + iri.substring(RDF.length);
  return iri;
}

export function localName(iri) {
  if (typeof iri !== 'string') return String(iri);
  const i = Math.max(iri.lastIndexOf('/'), iri.lastIndexOf('#'));
  return i >= 0 ? iri.substring(i + 1) : iri;
}

/** True if an IRI/CURIE is a local OpenREL policy (fetchable from the Policies folder). */
export function isLocalPolicy(iri) {
  return typeof iri === 'string' && iri.startsWith('openrel:');
}

const iri = (t) => (t ? t.value : '');
const lit = (t) => (t ? t.value : '');

/**
 * Parse a policy TTL document into a structured tree.
 * @param {string} ttlText
 * @param {{Parser: typeof import('n3').Parser}} N3 — N3.js namespace (window.N3 or the n3 module).
 * @returns {Promise<object|null>}
 */
export function parsePolicyTtl(ttlText, N3) {
  return new Promise((resolve, reject) => {
    const quads = [];
    const parser = new N3.Parser();
    parser.parse(ttlText, (err, quad) => {
      if (err) return reject(err);
      if (quad) { quads.push(quad); return; }
      try { resolve(buildPolicy(quads)); }
      catch (e) { reject(e); }
    });
  });
}

function buildPolicy(quads) {
  // subject value -> predicate value -> [term]
  const spo = new Map();
  for (const q of quads) {
    const s = q.subject.value;
    if (!spo.has(s)) spo.set(s, new Map());
    const preds = spo.get(s);
    const p = q.predicate.value;
    if (!preds.has(p)) preds.set(p, []);
    preds.get(p).push(q.object);
  }
  const get = (s, p) => (spo.get(s)?.get(p) || []);

  // Locate the policy subject: prefer an explicit policy type, else a subject
  // carrying odrl:permission/prohibition/obligation or openrel:hasPolicy.
  let policySubj = null;
  for (const [s, preds] of spo) {
    const types = get(s, RDF_TYPE).map(iri);
    if (types.some((t) => POLICY_TYPES.has(t))) { policySubj = s; break; }
  }
  if (!policySubj) {
    for (const [s, preds] of spo) {
      if (preds.has(ODRL + 'permission') || preds.has(ODRL + 'prohibition') ||
          preds.has(ODRL + 'obligation') || preds.has(OPENREL_NS + 'hasPolicy')) {
        policySubj = s; break;
      }
    }
  }
  if (!policySubj) return null;

  const types = get(policySubj, RDF_TYPE).map(iri).map(compactOpenrel);
  const titleTerm = get(policySubj, DCT + 'title')[0] || get(policySubj, OPENREL_NS + 'title')[0]
    || get(policySubj, SKOS + 'prefLabel')[0];
  const descTerm = get(policySubj, DCT + 'description')[0] || get(policySubj, OPENREL_NS + 'description')[0]
    || get(policySubj, SKOS + 'definition')[0];

  const hasPolicy = get(policySubj, OPENREL_NS + 'hasPolicy').map(iri).map(compactOpenrel);
  const permissions = get(policySubj, ODRL + 'permission').map((t) => buildRule(t, spo, 'Permission'));
  const prohibitions = get(policySubj, ODRL + 'prohibition').map((t) => buildRule(t, spo, 'Prohibition'));
  const obligations = get(policySubj, ODRL + 'obligation').map((t) => buildRule(t, spo, 'Obligation'));

  return {
    iri: compactOpenrel(policySubj),
    fullIri: policySubj,
    type: types,
    label: titleTerm ? lit(titleTerm) : '',
    definition: descTerm ? lit(descTerm) : '',
    hasPolicy,
    permissions,
    prohibitions,
    obligations,
    metadata: {
      status: get(policySubj, OPENREL_NS + 'policyStatus').map((t) => t.value),
      subjects: get(policySubj, DCT + 'subject').map((t) => compactOpenrel(iri(t))),
    },
  };
}

function buildRule(term, spo, ruleType) {
  const s = term.value;
  const get = (p) => (spo.get(s)?.get(p) || []);
  const actions = get(ODRL + 'action').map((t) => compactOpenrel(iri(t)));
  const target = get(ODRL + 'target').map((t) => compactOpenrel(iri(t)));
  const assigner = get(ODRL + 'assigner').map((t) => compactOpenrel(iri(t)));
  const assignee = get(ODRL + 'assignee').map((t) => compactOpenrel(iri(t)));
  const constraints = get(ODRL + 'constraint').map((c) => buildConstraint(c, spo));
  const duties = get(ODRL + 'duty').map((d) => buildRule(d, spo, 'Duty'));
  const consequences = get(ODRL + 'consequence').map((d) => buildRule(d, spo, 'Duty'));
  return {
    iri: compactOpenrel(s),
    type: ruleType,
    actions,
    target,
    assigner,
    assignee,
    constraints,
    duties,
    consequences,
  };
}

function buildConstraint(term, spo) {
  const s = term.value;
  const get = (p) => (spo.get(s)?.get(p) || []);
  return {
    iri: compactOpenrel(s),
    leftOperand: get(ODRL + 'leftOperand').map((t) => compactOpenrel(iri(t)))[0] || '',
    operator: get(ODRL + 'operator').map((t) => compactOpenrel(iri(t)))[0] || '',
    rightOperand: get(ODRL + 'rightOperand').map((t) => t.value)[0] || '',
    rightOperandReference: get(ODRL + 'rightOperandReference').map((t) => compactOpenrel(iri(t)))[0] || '',
    dataType: get(ODRL + 'dataType').map((t) => compactOpenrel(iri(t)))[0] || '',
  };
}
