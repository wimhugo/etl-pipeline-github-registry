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
    // Handle standard JSON and JSON Lines (newline-delimited)
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (_) {
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const parsed = [];
      for (const line of lines) {
        try { parsed.push(JSON.parse(line)); } catch (_2) { /* skip */ }
      }
      if (parsed.length > 0) json = parsed;
    }
    if (json) {
      // Unwrap wrapper objects like { content: [...policy] } — use first element of first array value
      let sample;
      let recordCount = null;
      if (!Array.isArray(json) && typeof json === 'object') {
        const wrapperKey = Object.keys(json).find(k => Array.isArray(json[k]));
        if (wrapperKey) {
          recordCount = json[wrapperKey].length;
          sample = json[wrapperKey][0];
        } else {
          sample = json;
        }
      } else {
        const arr = Array.isArray(json) ? json : [json];
        recordCount = arr.length;
        sample = arr[0];
      }
      const collected = [];
      function collectKeys(obj, prefix, depth) {
        if (!obj || typeof obj !== 'object' || depth > 3) return;
        for (const [k, v] of Object.entries(obj)) {
          const full = prefix ? `${prefix}.${k}` : k;
          collected.push(full);
          if (v && typeof v === 'object' && !Array.isArray(v) && depth < 2) {
            collectKeys(v, full, depth + 1);
          }
        }
      }
      collectKeys(sample, '', 0);
      fields = [...new Set(collected)];
      return Response.json({ fields, record_count: recordCount, preview: text.slice(0, 2000) });
    }
  }

  return Response.json({ fields, record_count: null, preview: text.slice(0, 2000) });
});