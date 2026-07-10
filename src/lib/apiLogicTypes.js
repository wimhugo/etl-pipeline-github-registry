export const LOGIC_TYPES = [
  {
    value: 'fetchApiSourceContent',
    label: 'Fetch Source File (Parsed)',
    description: 'Fetches and parses a source file by section name, returning members with IRI, label, and definition.',
    function_name: 'fetchApiSourceContent',
    params: [
      { key: 'section', label: 'Source File Section', type: 'select_source_file', required: true, description: 'The section name matching an ApiSourceFile record' },
      { key: 'include_raw', label: 'Include Raw Content', type: 'boolean', required: false, default: false, description: 'Whether to include the raw file content in the response' },
    ],
  },
  {
    value: 'getFileRaw',
    label: 'Get Raw File',
    description: 'Returns raw file content from a GitHub repository.',
    function_name: 'getFileRaw',
    params: [
      { key: 'file_path', label: 'File Path', type: 'text', required: true, description: 'Path to the file in the repository' },
      { key: 'repo', label: 'Repository (owner/repo)', type: 'text', required: false, description: 'Defaults to the global config repo if omitted' },
      { key: 'branch', label: 'Branch', type: 'text', required: false, default: 'main' },
      { key: 'limit', label: 'Line Limit', type: 'number', required: false, description: 'Maximum number of lines to return' },
      { key: 'offset', label: 'Line Offset', type: 'number', required: false, description: 'Number of lines to skip from the start' },
    ],
  },
];

export function getLogicType(value) {
  return LOGIC_TYPES.find(t => t.value === value);
}