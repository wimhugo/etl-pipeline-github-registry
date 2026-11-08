export const SOURCE_TYPES = ['Registry', 'Schema', 'Vocabulary', 'Example'];

const REGISTRY_SECTIONS = [
  'actions',
  'named constraints',
  'left operands',
  'parameters',
  'policies',
  'mappings',
];

const SCHEMA_SECTIONS = ['openrel classes', 'openrel properties'];

// Sources saved before the label existed get one derived from their section name.
export function deriveSourceType(sourceFile) {
  if (sourceFile?.source_type) return sourceFile.source_type;
  const section = String(sourceFile?.section || '').trim();
  const lower = section.toLowerCase();
  if (lower.startsWith('vocabulary')) return 'Vocabulary';
  if (SCHEMA_SECTIONS.includes(lower)) return 'Schema';
  if (REGISTRY_SECTIONS.includes(lower)) return 'Registry';
  return 'Example';
}