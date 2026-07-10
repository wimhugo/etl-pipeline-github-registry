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
  const desc = meta.description || 'API for accessing OpenREL knowledge base vocabulary sources';

  const active = (endpoints || []).filter(e => e.is_active !== false);

  const pathMap = {};
  for (const ep of active) {
    const cleanPath = '/' + (ep.path || '').replace(/^\/+/, '');
    if (!pathMap[cleanPath]) pathMap[cleanPath] = [];
    pathMap[cleanPath].push(ep);
  }

  const L = [];
  L.push('openapi: 3.0.3');
  L.push('info:');
  L.push(`  title: ${yamlStr(title)}`);
  L.push(`  version: ${yamlStr(version)}`);
  L.push(`  description: ${yamlStr(desc)}`);
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
      L.push(`      summary: ${yamlStr(ep.summary || `${ep.endpoint_type === 'detail' ? 'Get' : 'List'} ${ep.section || ''}`)}`);
      if (ep.description) {
        L.push(`      description: ${yamlStr(ep.description)}`);
      }

      const params = ep.parameters || [];
      if (params.length > 0) {
        L.push('      parameters:');
        for (const p of params) {
          L.push(`        - name: ${yamlStr(p.name)}`);
          L.push(`          in: ${p.in || 'query'}`);
          L.push(`          required: ${p.required ? 'true' : 'false'}`);
          L.push(`          schema:`);
          L.push(`            type: ${p.schema_type || 'string'}`);
          if (p.description) {
            L.push(`          description: ${yamlStr(p.description)}`);
          }
        }
      }

      L.push(`      responses:`);
      L.push(`        '200':`);
      L.push(`          description: Successful response`);
      L.push(`          content:`);
      L.push(`            application/json:`);
      L.push(`              schema:`);

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