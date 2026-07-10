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
          ...(ep.parameters || []).map(p => ({
            name: p.name,
            in: p.in || 'query',
            required: p.required || false,
            schema: { type: p.schema_type || 'string' },
            description: p.description || '',
          })),
          {
            name: 'format',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              default: 'json',
              enum: ['json', 'ttl'],
            },
            description: 'Output format. Select `ttl` for RDF Turtle output.',
          },
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: responseSchema,
              },
              'text/turtle': {
                schema: { type: 'string' },
              },
            },
          },
          '404': { description: 'Endpoint not found' },
          '501': { description: 'Endpoint not wired' },
        },
      };
    }
  }

  const spec = {
    openapi: '3.0.3',
    info: { title, version, description: desc },
    paths,
  };

  spec.tags = tagOrder.map(name => ({ name, description: '' }));

  if (serverUrl) {
    spec.servers = [{ url: serverUrl }];
  }

  return spec;
}