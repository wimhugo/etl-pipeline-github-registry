/**
 * Shared display helpers for the Reasoner Update UI.
 */

export function curieOf(iri) {
  if (!iri) return '';
  const bases = [
    ['http://www.w3.org/ns/openrel/0/', 'openrel:'],
    ['http://www.w3.org/ns/odrl/2/', 'odrl:'],
    ['http://creativecommons.org/ns#', 'cc:'],
    ['https://dalicc.net/ns#', 'dalicc:'],
    ['http://www.w3.org/2004/02/skos/core#', 'skos:'],
    ['http://purl.org/dc/terms/', 'dct:'],
  ];
  for (const [base, prefix] of bases) {
    if (iri.startsWith(base)) return prefix + iri.slice(base.length);
  }
  return iri;
}

export const relLocal = (iri) => curieOf(iri).replace(/^(openrel|odrl):/, '');