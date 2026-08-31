/**
 * odrlAdapter.js — Maps a parsed ODRL policy (+ vocab) into wizard-facing shapes.
 *
 * Framework-agnostic, no imports except the shared IRI helpers from odrlParser.
 * Two outputs:
 *   - buildTemplateCard : card summary for the browser grid (permits/prohibits/requires)
 *   - buildPreload      : the structured preload object the wizard consumes
 *
 * Composite (openrel:hasPolicy) policies are exposed as a reference tree: the
 * parent's own rules + a list of children marked local (fetchable) or external.
 */

import { compactOpenrel, localName, isLocalPolicy } from './odrlParser.js';

const unique = (arr) => [...new Set(arr.filter(Boolean))];
const allActions = (rules) => (rules || []).flatMap((r) => r.actions || []);

function resolveLabels(iris, actions) {
  if (!actions) return iris;
  const byIri = new Map(actions.map((a) => [a.iri, a.label || a.iri]));
  return iris.map((i) => byIri.get(i) || i);
}

/** Card summary for the template browser grid. */
export function buildTemplateCard(parsed, vocab = {}) {
  const typeChip = (parsed.type || [])
    .map((t) => t.replace('openrel:', '').replace('odrl:', ''))
    .find(Boolean) || 'Policy';
  const isComposite =
    (parsed.hasPolicy && parsed.hasPolicy.length > 0) ||
    parsed.type.includes('openrel:PolicyCollection');

  const permits = unique(allActions(parsed.permissions));
  const prohibits = unique(allActions(parsed.prohibitions));
  // "requires" = obligations + duties nested under permissions
  const dutyActions = (parsed.permissions || []).flatMap((p) =>
    (p.duties || []).flatMap((d) => d.actions || []));
  const requires = unique(allActions(parsed.obligations).concat(dutyActions));

  return {
    id: parsed.iri,
    label: parsed.label || localName(parsed.iri),
    desc: parsed.definition || '',
    type: typeChip,
    status: (parsed.metadata.status || [])[0] || '',
    permits: resolveLabels(permits, vocab.actions),
    prohibits: resolveLabels(prohibits, vocab.actions),
    requires: resolveLabels(requires, vocab.actions),
    tags: parsed.metadata.subjects || [],
    isComposite,
    children: (parsed.hasPolicy || []).map((h) => ({ iri: h, isLocal: isLocalPolicy(h) })),
  };
}

/**
 * Preload object for the wizard. The Advanced-Wizard shape (perms/prohs/oblis/cons)
 * is fully derivable from real ODRL today. Simple-Wizard fields (q1–q4) require the
 * openrel:simple* predicates planned in work stream 3; they are left null until then.
 */
export function buildPreload(parsed) {
  const collectCons = (rules) =>
    (rules || []).flatMap((r) => (r.constraints || []).map((c) => ({
      on: (r.actions || []).join(','),
      left: c.leftOperand, op: c.operator,
      right: c.rightOperand, rightRef: c.rightOperandReference, dt: c.dataType,
    })));

  return {
    iri: parsed.iri,
    ptype: (parsed.type.map((t) => t.replace('openrel:', '')).find(Boolean)) || 'Policy',
    label: parsed.label,
    desc: parsed.definition,
    perms: (parsed.permissions || []).map((p) => ({
      actions: p.actions, target: p.target, assigner: p.assigner, assignee: p.assignee,
      constraints: p.constraints,
      duties: (p.duties || []).map((d) => d.actions),
    })),
    prohs: (parsed.prohibitions || []).map((p) => ({
      actions: p.actions, target: p.target, assigner: p.assigner, assignee: p.assignee,
      constraints: p.constraints,
    })),
    oblis: (parsed.obligations || []).map((o) => ({
      actions: o.actions, target: o.target, constraints: o.constraints,
    })),
    cons: [
      ...collectCons(parsed.permissions),
      ...collectCons(parsed.prohibitions),
      ...collectCons(parsed.obligations),
    ],
    hasPolicy: parsed.hasPolicy || [],
    // Simple-Wizard fields: left null until openrel:simple* predicates are added
    // to the policy TTL files (migration plan work stream 3).
    simple: { q1: null, q2: null, q3: null, q4: null, geoInc: null, geoExc: null },
  };
}

/** Resolve the composite children of a parsed policy into fetchable / external refs. */
export function resolveCompositeChildren(parsed) {
  return (parsed.hasPolicy || []).map((h) => ({
    iri: h,
    apiId: compactOpenrel(h),
    isLocal: isLocalPolicy(h),
  }));
}
