/**
 * policyIndex.js — Framework-agnostic Policy Index adapter.
 *
 * Reads the curated Policy Index JSON and returns the exact shapes the wizard
 * UI consumes: a lean list for the browser grid, and a `preload` object for the
 * Simple Wizard. The index decouples discovery (this module) from detail
 * (the live TTL parse in odrlParser.js).
 *
 * The index source is pluggable via `fetchIndex`:
 *   - standalone HTML:  fetch('./policy_index.json')  (co-located static file)
 *   - React app / API:  the `PolicyIndex` ApiSourceFile section (JSON), fetched
 *                       via the apiProxy gateway.
 * In future the same contract backs an Elasticsearch catalogue with zero UI
 * change — only `fetchIndex` is swapped.
 */

/**
 * Default fetcher: load the co-located static index file.
 * Override with `createPolicyIndexAdapter({ fetchIndex })` to source from the API.
 */
async function defaultFetchIndex() {
  const res = await fetch('./policy_index.json');
  if (!res.ok) throw new Error('policy_index.json ' + res.status);
  return res.json();
}

export function createPolicyIndexAdapter(opts = {}) {
  const fetchIndex = opts.fetchIndex || defaultFetchIndex;
  let cache = null;

  async function getIndex() {
    if (cache) return cache;
    cache = await fetchIndex();
    return cache;
  }

  /**
   * Lean list for the browser grid / matrix.
   * Returns one card per policy with curated summary fields — no TTL parse.
   * Action IRIs are resolved to labels via the actions vocab if provided.
   */
  async function listCards(actionsVocab = []) {
    const idx = await getIndex();
    const byIri = new Map(actionsVocab.map(a => [a.iri, a.label || a.iri]));
    const labelOf = (iri) => byIri.get(iri) || iri;
    return (idx.policies || []).map(p => {
      const s = p.simple || {};
      const perms = (s.simplePerm || []).map(labelOf);
      const prohs = (s.simpleProhibit || []).map(labelOf);
      const duties = (s.simpleDuty || []).map(labelOf);
      return {
        id: p.iri,
        label: p.label,
        desc: p.description || '',
        type: p.type || 'Policy',
        status: p.status || '',
        tags: p.tags || [],
        isComposite: !!p.is_composite,
        childCount: (p.hasPolicy || []).length,
        children: (p.hasPolicy || []).map(h => ({ iri: h, isLocal: typeof h === 'string' && h.startsWith('openrel:') })),
        permits: perms,
        prohibits: prohs,
        requires: duties,
      };
    });
  }

  /**
   * Simple Wizard preload object for one policy, built from the index entry.
   * Detail rules/constraints are NOT included here — the Advanced Wizard and
   * the modal fetch those live from the policy TTL via odrlParser.
   */
  async function getPreload(iri) {
    const idx = await getIndex();
    const p = (idx.policies || []).find(x => x.iri === iri);
    if (!p) return null;
    const s = p.simple || {};
    return {
      iri: p.iri,
      ptype: (p.type || 'Policy'),
      label: p.label,
      desc: p.description,
      simple: {
        q1: s.q1 || null,
        simplePerm: s.simplePerm || [],
        simpleProhibit: s.simpleProhibit || [],
        simpleDuty: s.simpleDuty || [],
        q3: s.q3 || null,
        geoInc: s.geoInc || [],
        geoExc: s.geoExc || [],
        q4: s.q4 || null,
        dateStart: s.dateStart || null,
        dateEnd: s.dateEnd || null,
      },
      hasPolicy: p.hasPolicy || [],
    };
  }

  /** All IRIs in the index — used to validate/fallback the live TTL list. */
  async function listIris() {
    const idx = await getIndex();
    return (idx.policies || []).map(p => p.iri);
  }

  return { getIndex, listCards, getPreload, listIris };
}
