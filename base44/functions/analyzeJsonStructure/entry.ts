import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Recursively collect all leaf paths in an object, using dot-notation.
// Arrays are traversed by taking the union of keys across all elements.
function collectPaths(obj, prefix = '') {
  const paths = [];
  if (obj === null || typeof obj !== 'object') {
    paths.push(prefix);
    return paths;
  }
  if (Array.isArray(obj)) {
    // Collect paths from all array items (union)
    const seen = new Set();
    for (const item of obj) {
      for (const p of collectPaths(item, prefix)) {
        if (!seen.has(p)) { seen.add(p); paths.push(p); }
      }
    }
    return paths;
  }
  for (const key of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    const child = obj[key];
    if (child !== null && typeof child === 'object') {
      paths.push(...collectPaths(child, full));
    } else {
      paths.push(full);
    }
  }
  return paths;
}

// Flatten a single JSON record (Option B: all arrays merged with a 'type' discriminator).
// Returns an array of flat row objects.
function flattenRecord(obj) {
  // Find top-level scalar fields and array fields
  const scalars = {};
  const arrays = {};

  for (const [key, val] of Object.entries(obj)) {
    if (Array.isArray(val)) {
      arrays[key] = val;
    } else if (val !== null && typeof val === 'object') {
      // Recurse into nested objects (e.g. "policy": { ... })
      return flattenRecord(val);
    } else {
      scalars[key] = val;
    }
  }

  // If no arrays found, return as a single row
  if (Object.keys(arrays).length === 0) {
    return [{ ...scalars }];
  }

  // Option B: one row per array element across all arrays, with a 'type' column
  const rows = [];
  for (const [arrayKey, items] of Object.entries(arrays)) {
    for (const item of items) {
      const row = { type: arrayKey, ...scalars };
      flattenItem(item, '', row);
      rows.push(row);
    }
  }
  return rows;
}

// Flatten a single array item into a row object using dot-notation for nested objects
function flattenItem(obj, prefix, row) {
  if (obj === null || typeof obj !== 'object') {
    if (prefix) row[prefix] = obj;
    return;
  }
  if (Array.isArray(obj)) {
    // Join arrays as semicolon-separated strings
    row[prefix] = obj.map(i => (typeof i === 'object' ? JSON.stringify(i) : i)).join('; ');
    return;
  }
  for (const [key, val] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      flattenItem(val, full, row);
    } else if (Array.isArray(val)) {
      row[full] = val.map(i => (typeof i === 'object' ? JSON.stringify(i) : i)).join('; ');
    } else {
      row[full] = val ?? '';
    }
  }
}

// Unwrap a single-key object wrapper (e.g. { policy: {...} } → {...})
function unwrapEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
  const keys = Object.keys(entry);
  if (keys.length === 1 && entry[keys[0]] !== null && typeof entry[keys[0]] === 'object' && !Array.isArray(entry[keys[0]])) {
    return entry[keys[0]];
  }
  return entry;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { file_url } = await req.json();
  if (!file_url) return Response.json({ error: 'file_url required' }, { status: 400 });

  const res = await fetch(file_url);
  if (!res.ok) return Response.json({ error: 'Failed to fetch source file' }, { status: 500 });

  const json = await res.json();

  // Step 1: unwrap outer wrapper { content: [...] }
  let entries;
  if (!Array.isArray(json) && typeof json === 'object') {
    const wrapperKey = Object.keys(json).find(k => Array.isArray(json[k]));
    entries = wrapperKey ? json[wrapperKey] : [json];
  } else {
    entries = Array.isArray(json) ? json : [json];
  }

  // Step 2: unwrap each entry's single-key wrapper (e.g. { policy: {...} } → {...})
  // then flatten — scan across multiple entries to get the full union of columns
  const allColumns = [];
  const seen = new Set();
  let previewRows = [];

  for (const entry of entries) {
    const unwrapped = unwrapEntry(entry);
    const rows = flattenRecord(unwrapped);
    for (const row of rows) {
      for (const col of Object.keys(row)) {
        if (!seen.has(col)) { seen.add(col); allColumns.push(col); }
      }
    }
    if (previewRows.length < 3) previewRows = previewRows.concat(rows).slice(0, 3);
    // Once we've seen all 4 array types, we have enough columns
    if (seen.has('permissions') || (seen.has('type') && allColumns.length > 8)) break;
  }

  // field_mapping: { csvColumn -> csvColumn } — identity mapping (column name == source path)
  const field_mapping = {};
  for (const col of allColumns) field_mapping[col] = col;

  return Response.json({ columns: allColumns, field_mapping, preview: previewRows });
});