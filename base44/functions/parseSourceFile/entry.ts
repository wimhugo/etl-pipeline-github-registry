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
      // Step 1: unwrap outer array wrapper { content: [...] }
      let entries;
      let recordCount = null;
      if (!Array.isArray(json) && typeof json === 'object') {
        const wrapperKey = Object.keys(json).find(k => Array.isArray(json[k]));
        if (wrapperKey) {
          entries = json[wrapperKey];
          recordCount = entries.length;
        } else {
          entries = [json];
        }
      } else {
        entries = Array.isArray(json) ? json : [json];
        recordCount = entries.length;
      }

      // Step 2: unwrap each entry's single-key object wrapper (e.g. { policy: {...} } → {...})
      const unwrap = (entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
        const keys = Object.keys(entry);
        if (keys.length === 1 && entry[keys[0]] !== null && typeof entry[keys[0]] === 'object' && !Array.isArray(entry[keys[0]])) {
          return entry[keys[0]];
        }
        return entry;
      };
      const sample = unwrap(entries[0]);

      // Step 3: collect fields from the unwrapped sample, including nested keys in array items
      const collected = new Set();
      function collectKeys(obj, prefix, depth) {
        if (!obj || typeof obj !== 'object' || depth > 4) return;
        for (const [k, v] of Object.entries(obj)) {
          const full = prefix ? `${prefix}.${k}` : k;
          if (Array.isArray(v)) {
            collected.add(full); // the array key itself (= "type" discriminator)
            // also collect keys from first item of the array
            if (v.length > 0 && typeof v[0] === 'object') collectKeys(v[0], '', depth + 1);
          } else if (v && typeof v === 'object') {
            collectKeys(v, full, depth + 1);
          } else {
            collected.add(full);
          }
        }
      }
      collectKeys(sample, '', 0);
      fields = [...collected];
      return Response.json({ fields, record_count: recordCount, preview: text.slice(0, 2000) });
    }
  }

  return Response.json({ fields, record_count: null, preview: text.slice(0, 2000) });
});