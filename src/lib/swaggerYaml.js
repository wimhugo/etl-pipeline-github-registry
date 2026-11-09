function yamlStr(val) {
  const s = String(val || '');
  if (s === '') return '""';
  if (/[:#{}[\],&*!|>'"%@`\n]/.test(s) || s.startsWith(' ') || s.endsWith(' ')) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}

export function generateSwaggerYaml(endpoints, meta = {}) {
  const title = meta.title || 'OpenREL KB API';
  const version = meta.version || '0.4.0';
  const descBase = meta.description || 'API for accessing OpenREL knowledge base vocabulary sources';
  const desc = `${descBase}. RDF-backed endpoints return Turtle (text/turtle) by default; application/json and application/ld+json are alternative representations.`;

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

  const L = [];
  L.push('openapi: 3.0.3');
  L.push('info:');
  L.push(`  title: ${yamlStr(title)}`);
  L.push(`  version: ${yamlStr(version)}`);
  L.push(`  description: ${yamlStr(desc)}`);
  if (tagOrder.length > 0) {
    L.push('tags:');
    for (const tag of tagOrder) {
      L.push(`  - name: ${yamlStr(tag)}`);
      L.push(`    description: ""`);
    }
  }
  L.push('paths:');

  if (Object.keys(pathMap).length === 0) {
    L.push('  {}');
    return L.join('\n');
  }

  for (const [path, eps] of Object.entries(pathMap)) {
    L.push(`  ${path}:`);
    for (const ep of eps) {
      const method = (ep.method || 'GET').toLowerCase();
      L.push(`    ${method}:`);
      L.push(`      tags:`);
      L.push(`        - ${yamlStr(ep.tag || 'default')}`);
      L.push(`      summary: ${yamlStr(ep.summary || `${ep.endpoint_type === 'detail' ? 'Get' : 'List'} ${ep.section || ''}`)}`);
      if (ep.description) {
        L.push(`      description: ${yamlStr(ep.description)}`);
      }

      // Auto-extract path template parameters (e.g. {id} from /actionclasses/{id})
      const pathParamNames = (path.match(/\{([^}]+)\}/g) || []).map(p => p.slice(1, -1));
      const existingNames = new Set((ep.parameters || []).map(p => p.name));
      const autoPathParams = pathParamNames
        .filter(name => !existingNames.has(name))
        .map(name => ({ name, in: 'path', required: true, schema_type: 'string', description: `The ${name} of the resource to retrieve` }));

      // RDF-backed sources are Turtle-native; other handlers only produce JSON.
      const isRdf = (ep.target_logic_type || 'fetchApiSourceContent') === 'fetchApiSourceContent';

      const formatParam = {
        name: 'format',
        in: 'query',
        required: false,
        schema_type: 'string',
        enum: ['ttl', 'json', 'json-ld'],
        description: 'Response representation. ttl (RDF Turtle) is native and the default; json and json-ld are alternatives. The Accept header is honoured as well.',
      };

      const params = [
        ...autoPathParams,
        ...(ep.parameters || []).filter(p => p.name !== 'format'),
        ...(isRdf ? [formatParam] : []),
      ];
      if (params.length > 0) {
        L.push('      parameters:');
        for (const p of params) {
          L.push(`        - name: ${yamlStr(p.name)}`);
          L.push(`          in: ${p.in || 'query'}`);
          L.push(`          required: ${p.required ? 'true' : 'false'}`);
          L.push(`          schema:`);
          L.push(`            type: ${p.schema_type || 'string'}`);
          if (p.enum) {
            L.push(`            default: ${p.enum[0]}`);
            L.push(`            enum:`);
            for (const v of p.enum) L.push(`              - ${v}`);
          }
          if (p.description) {
            L.push(`          description: ${yamlStr(p.description)}`);
          }
        }
      }

      L.push(`      responses:`);
      L.push(`        '200':`);
      L.push(`          description: Successful response`);
      L.push(`          content:`);
      if (isRdf) {
        L.push(`            text/turtle:`);
        L.push(`              description: Native default representation (RDF Turtle)`);
        L.push(`              schema:`);
        L.push(`                type: string`);
        L.push(`            application/ld+json:`);
        L.push(`              description: JSON-LD alternative (Accept: application/ld+json, or ?format=json-ld)`);
        L.push(`              schema:`);
        L.push(`                type: object`);
        L.push(`            application/json:`);
        L.push(`              description: Plain JSON alternative (Accept: application/json, or ?format=json)`);
        L.push(`              schema:`);
      } else {
        L.push(`            application/json:`);
        L.push(`              schema:`);
      }

      if (ep.endpoint_type === 'detail') {
        L.push(`                type: object`);
        L.push(`                properties:`);
        L.push(`                  iri:`);
        L.push(`                    type: string`);
        L.push(`                  label:`);
        L.push(`                    type: string`);
        L.push(`                  definition:`);
        L.push(`                    type: string`);
      } else {
        L.push(`                type: array`);
        L.push(`                items:`);
        L.push(`                  type: object`);
        L.push(`                  properties:`);
        L.push(`                    iri:`);
        L.push(`                      type: string`);
        L.push(`                    label:`);
        L.push(`                      type: string`);
        L.push(`                    definition:`);
        L.push(`                      type: string`);
      }
    }
  }

  return L.join('\n');
}