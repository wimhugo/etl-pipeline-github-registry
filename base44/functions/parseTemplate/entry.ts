import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { template_content } = await req.json();

  // Extract all placeholder keys from a JSON/JSON-LD template
  // Supports: "{{fieldName}}", "${fieldName}", "<fieldName>" patterns
  const placeholderRegex = /\{\{(\w[\w.]*)\}\}|\$\{(\w[\w.]*)\}|"<(\w[\w.]*)>"/g;

  const fields = new Set();
  let match;
  while ((match = placeholderRegex.exec(template_content)) !== null) {
    fields.add(match[1] || match[2] || match[3]);
  }

  // If no placeholders found, extract all string-value keys from the JSON
  if (fields.size === 0) {
    const json = JSON.parse(template_content);
    const extractKeys = (obj, prefix = '') => {
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string') fields.add(prefix ? `${prefix}.${k}` : k);
        else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          extractKeys(v, prefix ? `${prefix}.${k}` : k);
        }
      }
    };
    extractKeys(json);
  }

  return Response.json({ fields: [...fields] });
});