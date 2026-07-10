export function generateSwaggerSpec(endpoints, meta = {}) {
  const title = meta.title || 'OpenREL KB API';
  const version = meta.version || '0.4.0';
  const desc = meta.description || 'API for accessing OpenREL knowledge base vocabulary sources';
  const serverUrl = meta.serverUrl || '';

  const active = (endpoints || []).filter(e => e.is_active !== false);

  const pathMap = {};
  for (const ep of active) {
    const cleanPath = '/' + (ep.path || '').replace(/^\/+/, '');
    if (!pathMap[cleanPath]) pathMap[cleanPath] = [];
    pathMap[cleanPath].push(ep);
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

      paths[path][m] = {
        summary: ep.summary || '',
        description: ep.description || '',
        parameters: [
          ...(ep.parameters || []).map(p => ({
            name: p.name,
            in: p.in || 'query',
            required: p.required || false,
            schema: { type: p.schema_type || 'string' },
            description: p.description || '',
          })),
          {
            name: 'Accept',
            in: 'header',
            required: false,
            schema: { type: 'string', default: 'application/json' },
            description: 'Response media type. Use `text/turtle` for RDF Turtle output.',
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

  if (serverUrl) {
    spec.servers = [{ url: serverUrl }];
  }

  return spec;
}