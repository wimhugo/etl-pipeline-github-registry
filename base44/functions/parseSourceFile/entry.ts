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
    // Handle standard JSON, JSON Lines (one object per line), and concatenated JSON objects
    let json;
    try {
      json = JSON.parse(text);
    } catch (_) {
      // Try JSON Lines format (newline-delimited JSON)
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const parsed = [];
      for (const line of lines) {
        try { parsed.push(JSON.parse(line)); } catch (_) { /* skip */ }
      }
      json = parsed.length > 0 ? parsed : null;
    }
    if (json) {
      const sample = Array.isArray(json) ? json[0] : json;
      // Collect top-level keys; for nested objects also include dot-notation paths
      function collectKeys(obj, prefix, depth) {
        if (!obj || typeof obj !== 'object' || depth > 3) return;
        for (const [k, v] of Object.entries(obj)) {
          const full = prefix ? `${prefix}.${k}` : k;
          fields.push(full);
          if (v && typeof v === 'object' && !Array.isArray(v) && depth < 2) {
            collectKeys(v, full, depth + 1);
          }
        }
      }
      collectKeys(sample, '', 0);
      fields = [...new Set(fields)];
    }
  }

  return Response.json({ fields, preview: text.slice(0, 2000) });
});