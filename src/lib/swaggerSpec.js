const RDF_LOGIC = 'fetchApiSourceContent';

const TURTLE_EXAMPLE = [
  '@prefix odrl: <http://www.w3.org/ns/odrl/2/> .',
  '@prefix skos: <http://www.w3.org/2004/02/skos/core#> .',
  '',
  'openrel:anonymize a odrl:Action ;',
  '    skos:prefLabel "Anonymize" ;',
  '    skos:definition "Transform data so that subject entities cannot be identified." .',
].join('\n');

const JSONLD_EXAMPLE = {
  '@context': {
    odrl: 'http://www.w3.org/ns/odrl/2/',
    skos: 'http://www.w3.org/2004/02/skos/core#',
    openrel: 'http://www.w3id.org/ns/openrel/0/',
  },
  '@graph': [
    {
      '@id': 'openrel:anonymize',
      '@type': 'odrl:Action',
      'skos:prefLabel': 'Anonymize',
      'skos:definition': 'Transform data so that subject entities cannot be identified.',
    },
  ],
};

export function generateSwaggerSpec(endpoints, meta = {}) {
  const title = meta.title || 'OpenREL KB API';
  const version = meta.version || '0.4.0';
  const desc = meta.description || 'API for accessing OpenREL knowledge base vocabulary sources';
  const serverUrl = meta.serverUrl || '';

  const active = (endpoints || [])
    .filter(e => e.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const pathMap = {};
  const tagOrder = [];
  const tagSet = new Set();
  for (const ep of active) {
    const cleanPath = '/' + (ep.path || '').replace(/^\/+/, '');
    if (!pathMap[cleanPath]) pathMap[cleanPath] = [];
    pathMap[cleanPath].push(ep);
    const tag = ep.tag || 'default';
    if (!tagSet.has(tag)) { tagSet.add(tag); tagOrder.push(tag); }
  }

  const paths = {};
  for (const [path, eps] of Object.entries(pathMap)) {
    paths[path] = {};
    for (const ep of eps) {
      const m = (ep.method || 'GET').toLowerCase();
      const memberSchema = {
        type: 'object',
        properties: {
          iri: { type: 'string' },
          label: { type: 'string' },
          definition: { type: 'string' },
        },
      };
      const responseSchema = ep.endpoint_type === 'detail'
        ? memberSchema
        : { type: 'array', items: memberSchema };

      // RDF-backed sources are Turtle-native; other handlers only produce JSON.
      const isRdf = (ep.target_logic_type || RDF_LOGIC) === RDF_LOGIC;

      const jsonExample = ep.endpoint_type === 'detail'
        ? { iri: 'openrel:anonymize', label: 'Anonymize', definition: 'Transform data so that subject entities cannot be identified.' }
        : [{ iri: 'openrel:anonymize', label: 'Anonymize', definition: 'Transform data so that subject entities cannot be identified.' }];

      const responseContent = isRdf
        ? {
            'text/turtle': {
              description: 'Native default representation (RDF Turtle)',
              schema: { type: 'string' },
              example: TURTLE_EXAMPLE,
            },
            'application/ld+json': {
              description: 'JSON-LD alternative (Accept: application/ld+json, or ?format=json-ld)',
              schema: { type: 'object' },
              example: JSONLD_EXAMPLE,
            },
            'application/json': {
              description: 'Plain JSON alternative (Accept: application/json, or ?format=json)',
              schema: responseSchema,
              example: jsonExample,
            },
          }
        : {
            'application/json': {
              schema: responseSchema,
              example: jsonExample,
            },
          };

      // Auto-extract path template parameters (e.g. {id} from /actionclasses/{id})
      const pathParamNames = (path.match(/\{([^}]+)\}/g) || []).map(p => p.slice(1, -1));
      const existingNames = new Set((ep.parameters || []).map(p => p.name));
      const autoPathParams = pathParamNames
        .filter(name => !existingNames.has(name))
        .map(name => ({
          name,
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: `The ${name} of the resource to retrieve`,
        }));

      paths[path][m] = {
        tags: [ep.tag || 'default'],
        summary: ep.summary || '',
        description: ep.description || '',
        parameters: [
          ...autoPathParams,
          ...(ep.parameters || []).filter(p => p.name !== 'format').map(p => ({
            name: p.name,
            in: p.in || 'query',
            required: p.required || false,
            schema: { type: p.schema_type || 'string' },
            description: p.description || '',
          })),
          ...(isRdf ? [{
            name: 'format',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              default: 'ttl',
              enum: ['ttl', 'json', 'json-ld'],
            },
            description: 'Response representation. `ttl` (RDF Turtle) is native and the default; `json` and `json-ld` are alternatives. The Accept header is honoured as well.',
          }] : []),
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: responseContent,
          },
          '404': { description: 'Endpoint not found' },
          '501': { description: 'Endpoint not wired' },
        },
      };
    }
  }

  const spec = {
    openapi: '3.0.3',
    info: {
      title,
      version,
      description: `${desc}. RDF-backed endpoints return Turtle (text/turtle) by default; application/json and application/ld+json are available as alternative representations.`,
    },
    paths,
  };

  spec.tags = tagOrder.map(name => ({ name, description: '' }));

  if (serverUrl) {
    spec.servers = [{ url: serverUrl }];
  }

  return spec;
}