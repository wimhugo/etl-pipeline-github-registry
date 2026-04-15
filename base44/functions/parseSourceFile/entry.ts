import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { file_url, file_name } = await req.json();

  const res = await fetch(file_url);
  const text = await res.text();

  const ext = (file_name || '').split('.').pop().toLowerCase();
  let fields = [];

  if (ext === 'csv') {
    // Parse first line as headers
    const firstLine = text.split('\n')[0];
    fields = firstLine.split(',').map(f => f.trim().replace(/^"|"$/g, ''));
  } else if (ext === 'txt') {
    // Support "Label: value" format — extract labels
    const lines = text.split('\n').filter(l => l.includes(':'));
    fields = lines.map(l => l.split(':')[0].trim()).filter(Boolean);
    // Deduplicate
    fields = [...new Set(fields)];
  } else if (ext === 'json') {
    const json = JSON.parse(text);
    const sample = Array.isArray(json) ? json[0] : json;
    fields = Object.keys(sample || {});
  }

  return Response.json({ fields, preview: text.slice(0, 2000) });
});