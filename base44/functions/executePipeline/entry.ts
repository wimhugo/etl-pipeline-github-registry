import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Parse CSV text into array of row objects
function parseCsv(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values = [];
    let cur = '', inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { values.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    values.push(cur.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = (values[i] || '').replace(/^"|"$/g, ''); });
    return row;
  });
}

// Flatten a single array item into a row object using dot-notation for nested objects
function flattenItem(obj, prefix, row) {
  if (obj === null || typeof obj !== 'object') {
    if (prefix) row[prefix] = obj;
    return;
  }
  if (Array.isArray(obj)) {
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

// Option B flatten: all arrays merged with a 'type' discriminator
function flattenJsonRecord(obj) {
  const scalars = {};
  const arrays = {};
  for (const [key, val] of Object.entries(obj)) {
    if (Array.isArray(val)) arrays[key] = val;
    else if (val !== null && typeof val === 'object') return flattenJsonRecord(val);
    else scalars[key] = val;
  }
  if (Object.keys(arrays).length === 0) return [{ ...scalars }];
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

// Parse source file into array of row objects based on type
function parseSource(text, sourceType) {
  if (sourceType === 'json') {
    const json = JSON.parse(text);
    // Unwrap common wrapper patterns: { content: [...] } or { policy: [...] }
    let entries;
    if (!Array.isArray(json) && typeof json === 'object') {
      const wrapperKey = Object.keys(json).find(k => Array.isArray(json[k]));
      entries = wrapperKey ? json[wrapperKey] : [json];
    } else {
      entries = json;
    }
    // Flatten each entry (e.g. each policy object)
    return entries.flatMap(r => flattenJsonRecord(r));
  }
  return parseCsv(text);
}

// Build CSV string from array of record objects using field_mapping
// fieldMapping: { csvColumn: sourceField }
function buildCsv(records, fieldMapping) {
  const columns = Object.keys(fieldMapping);
  const header = columns.map(c => `"${c}"`).join(',');
  const dataRows = records.map(rec => {
    return columns.map(col => {
      const val = String(rec[col] ?? '').replace(/"/g, '""');
      return `"${val}"`;
    }).join(',');
  });
  return [header, ...dataRows].join('\n');
}

// Apply field_mapping to produce a flat CSV row object from a source record
// fieldMapping: { outputColumn: sourceField }
function applyMappingToCsvRow(fieldMapping, row) {
  const rowLower = buildRowLookup(row);
  const result = {};
  for (const [outCol, srcField] of Object.entries(fieldMapping)) {
    if (row[srcField] !== undefined) result[outCol] = String(row[srcField]);
    else result[outCol] = String(rowLower[srcField.toLowerCase()] ?? '');
  }
  return result;
}

// Apply field_mapping to fill a template string for a single row
function applyTemplate(templateStr, fieldMapping, row) {
  let result = templateStr;
  for (const [templateField, sourceField] of Object.entries(fieldMapping)) {
    const value = row[sourceField] !== undefined ? row[sourceField] : '';
    // Escape templateField for use in regex (handles colons, dots, slashes etc.)
    const escapedKey = templateField.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`"{{${escapedKey}}}"`, 'g'), JSON.stringify(value));
    result = result.replace(new RegExp(`{{${escapedKey}}}`, 'g'), value);
  }
  return result;
}

// Build a case-insensitive lookup map from a row
function buildRowLookup(row) {
  const lookup = {};
  for (const key of Object.keys(row)) {
    lookup[key.toLowerCase()] = row[key];
  }
  return lookup;
}

// Build a record object by applying field_mapping directly (no JSON parse round-trip)
function applyMappingToObject(templateObj, fieldMapping, row) {
  const result = JSON.parse(JSON.stringify(templateObj)); // deep clone
  const rowLower = buildRowLookup(row);
  function resolveValue(sourceField) {
    if (row[sourceField] !== undefined) return row[sourceField];
    return rowLower[sourceField.toLowerCase()] ?? '';
  }
  function fillObject(obj) {
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string') {
        const placeholder = obj[key].match(/^{{(.+)}}$/);
        if (placeholder) {
          // Explicit {{field}} placeholder
          const sourceField = fieldMapping[placeholder[1]];
          if (sourceField !== undefined) obj[key] = resolveValue(sourceField);
        } else if (obj[key] === '') {
          // Empty string: use the key itself as the template field name
          const sourceField = fieldMapping[key];
          if (sourceField !== undefined) obj[key] = resolveValue(sourceField);
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        fillObject(obj[key]);
      }
    }
  }
  fillObject(result);
  return result;
}

// Safe base64 encode for unicode
function encodeBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

Deno.serve(async (req) => {
  try {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { pipeline_id, github_token } = await req.json();
  // Prefer: explicit param > GlobalConfig token > env secret
  let token = github_token;
  if (!token) {
    const configs = await base44.asServiceRole.entities.GlobalConfig.list();
    token = configs[0]?.github_token;
  }
  if (!token) token = Deno.env.get('GITHUB_TOKEN');
  if (!token) return Response.json({ error: 'No GitHub token configured' }, { status: 400 });

  const pipelines = await base44.entities.Pipeline.filter({ id: pipeline_id });
  const pipeline = pipelines[0];
  if (!pipeline) return Response.json({ error: 'Pipeline not found' }, { status: 404 });

  const startedAt = new Date().toISOString();
  const logs = [];

  const sourceType = pipeline.source_type || 'csv';
  const outputType = pipeline.output_type || 'json';

  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'OpenREL-App',
  };

  // Normalize repo: strip any leading URL so we always have "owner/repo"
  const rawRepo = pipeline.github_repo || '';
  const repo = rawRepo.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
  const branch = pipeline.github_branch || 'main';
  const targetFolder = (pipeline.github_target_folder || 'data').replace(/\/$/, '');

  if (!repo) return Response.json({ error: 'No GitHub repo configured on pipeline' }, { status: 400 });
  if (!pipeline.source_file_url) return Response.json({ error: 'No source file configured' }, { status: 400 });
  if (!pipeline.template && outputType === 'json') return Response.json({ error: 'No template configured' }, { status: 400 });
  if (!pipeline.field_mapping || Object.keys(pipeline.field_mapping).length === 0) {
    return Response.json({ error: 'No field mappings configured' }, { status: 400 });
  }

  // 1. Fetch and parse the source file
  logs.push(`[INFO] Fetching source file (type: ${sourceType})...`);
  const csvRes = await fetch(pipeline.source_file_url);
  if (!csvRes.ok) return Response.json({ error: 'Failed to fetch source file' }, { status: 500 });
  const sourceText = await csvRes.text();
  const rows = parseSource(sourceText, sourceType);
  logs.push(`[INFO] Parsed ${rows.length} records from source`);

  // 2. Get the default branch SHA to base PR branch off
  logs.push(`[INFO] Getting base branch ref for ${branch}...`);
  const refRes = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/${branch}`, { headers });
  const refData = await refRes.json();
  if (!refRes.ok) return Response.json({ error: `GitHub ref error: ${refData.message}` }, { status: refRes.status });
  const baseSha = refData.object.sha;

  // 3. Create a new PR branch
  const prBranch = `openrel/pipeline-${pipeline.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
  logs.push(`[INFO] Creating branch ${prBranch}...`);
  const branchRes = await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ref: `refs/heads/${prBranch}`, sha: baseSha }),
  });
  const branchData = await branchRes.json();
  if (!branchRes.ok) return Response.json({ error: `Failed to create branch: ${branchData.message}` }, { status: branchRes.status });

  // 4. Write files — inventory mode: one bundled file; default: one file per row
  const outputFiles = [];
  let written = 0;

  // Build a set of all field keys present across ALL rows (case-insensitive)
  const allFieldKeys = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) allFieldKeys.add(key.toLowerCase());
  }
  // Keep a mapping entry if its source field appears in ANY row
  const validMapping = {};
  for (const [tField, sField] of Object.entries(pipeline.field_mapping)) {
    if (allFieldKeys.has(sField.toLowerCase())) {
      validMapping[tField] = sField;
    } else {
      logs.push(`[WARN] Skipping stale mapping: "${tField}" -> "${sField}" (source field not found in any row)`);
    }
  }
  logs.push(`[DEBUG] Valid mapping entries: ${Object.keys(validMapping).length}`);

  if (pipeline.inventory_mode) {
    logs.push(`[INFO] Inventory mode: bundling ${rows.length} records into single file (output: ${outputType})...`);

    let fileContent, filePath;

    if (outputType === 'csv') {
      // Map each source row to a CSV row using field_mapping { csvColumn: sourceField }
      const csvRows = rows.map(row => applyMappingToCsvRow(validMapping, row));
      fileContent = buildCsv(csvRows, validMapping);
      filePath = `${targetFolder}/${pipeline.name.replace(/\s+/g, '_').toLowerCase()}.csv`;
    } else {
      // JSON output
      let templateObj;
      try {
        templateObj = JSON.parse(pipeline.template);
        logs.push(`[DEBUG] Template parsed OK, keys: ${Object.keys(templateObj).join(', ')}`);
      } catch(e) {
        templateObj = null;
        logs.push(`[WARN] Template is not valid JSON: ${e.message}`);
      }
      const allRecords = rows.map(row =>
        templateObj
          ? applyMappingToObject(templateObj, validMapping, row)
          : JSON.parse(applyTemplate(pipeline.template, validMapping, row))
      );
      if (allRecords.length > 0) logs.push(`[DEBUG] First transformed record: ${JSON.stringify(allRecords[0])}`);
      fileContent = JSON.stringify(allRecords, null, 2);
      filePath = `${targetFolder}/${pipeline.name.replace(/\s+/g, '_').toLowerCase()}.json`;
    }

    // Get existing file SHA from the BASE branch so we always replace, not append
    let existingSha;
    const checkRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`, { headers });
    if (checkRes.ok) {
      existingSha = (await checkRes.json()).sha;
      logs.push(`[INFO] Existing file found on base branch, will replace (sha: ${existingSha.slice(0,7)})`);
    }

    const putBody = { message: `feat: update ${pipeline.name} inventory via openrel`, content: encodeBase64(fileContent), branch: prBranch };
    if (existingSha) putBody.sha = existingSha;

    const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      method: 'PUT', headers, body: JSON.stringify(putBody),
    });
    if (putRes.ok) { outputFiles.push(filePath); written = rows.length; }
    else { const err = await putRes.json(); logs.push(`[WARN] Failed to write inventory file: ${err.message}`); }

    logs.push(`[INFO] Written inventory file: ${filePath}`);
  } else {
    // Group rows by their 'type' field and write one file per type
    logs.push(`[INFO] Grouping ${rows.length} records by type into ${targetFolder}/...`);
    let templateObj;
    try { templateObj = pipeline.template ? JSON.parse(pipeline.template) : null; } catch(e) { templateObj = null; }

    // Group rows by type
    const groups = {};
    for (const row of rows) {
      const typeKey = (row.type || 'records').replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
      if (!groups[typeKey]) groups[typeKey] = [];
      groups[typeKey].push(row);
    }
    logs.push(`[DEBUG] Groups found: ${Object.keys(groups).join(', ')}`);

    for (const [groupName, groupRows] of Object.entries(groups)) {
      const ext = outputType === 'csv' ? 'csv' : 'json';
      const filePath = `${targetFolder}/${groupName}.${ext}`;

      let fileContent;
      if (outputType === 'csv') {
        const csvRows = groupRows.map(row => applyMappingToCsvRow(validMapping, row));
        fileContent = buildCsv(csvRows, validMapping);
      } else {
        const records = groupRows.map(row =>
          templateObj
            ? applyMappingToObject(templateObj, validMapping, row)
            : JSON.parse(applyTemplate(pipeline.template, validMapping, row))
        );
        fileContent = JSON.stringify(records, null, 2);
      }

      // Get existing SHA from base branch to allow overwrite
      let existingSha;
      const checkRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`, { headers });
      if (checkRes.ok) { existingSha = (await checkRes.json()).sha; }

      const putBody = { message: `feat: update ${groupName} via openrel pipeline`, content: encodeBase64(fileContent), branch: prBranch };
      if (existingSha) putBody.sha = existingSha;

      const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
        method: 'PUT', headers, body: JSON.stringify(putBody),
      });
      if (putRes.ok) { outputFiles.push(filePath); written += groupRows.length; }
      else { const err = await putRes.json(); logs.push(`[WARN] Failed to write ${filePath}: ${err.message}`); }
    }
    logs.push(`[INFO] Written ${Object.keys(groups).length} files (${written} total records)`);
  }

  // 5. Create Pull Request
  logs.push(`[INFO] Creating pull request...`);
  const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: `OpenREL: ${pipeline.name} — ${written} records (${new Date().toLocaleDateString()})`,
      head: prBranch,
      base: branch,
      body: `Automated output from OpenREL pipeline \`${pipeline.name}\`.\n\n- **Records processed:** ${written}\n- **Target folder:** \`${targetFolder}\`\n- **Mapping:** ${Object.entries(pipeline.field_mapping).map(([t, s]) => `\`${t}\` ← \`${s}\``).join(', ')}`,
    }),
  });
  const prData = await prRes.json();
  if (!prRes.ok) return Response.json({ error: `Failed to create PR: ${prData.message}` }, { status: prRes.status });

  logs.push(`[INFO] PR created: ${prData.html_url}`);

  const completedAt = new Date().toISOString();
  const durationSeconds = Math.round((new Date(completedAt) - new Date(startedAt)) / 1000);

  // 6. Update pipeline stats
  const totalRuns = (pipeline.total_runs || 0) + 1;
  const prevSuccesses = Math.round(((pipeline.success_rate || 0) / 100) * (pipeline.total_runs || 0));
  await base44.asServiceRole.entities.Pipeline.update(pipeline_id, {
    last_run_at: startedAt,
    last_run_status: 'success',
    total_runs: totalRuns,
    success_rate: Math.round(((prevSuccesses + 1) / totalRuns) * 100),
    output_inventory: outputFiles,
  });

  // 7. Create run record
  await base44.asServiceRole.entities.PipelineRun.create({
    pipeline_id,
    pipeline_name: pipeline.name,
    status: 'success',
    started_at: startedAt,
    completed_at: completedAt,
    records_extracted: rows.length,
    records_transformed: written,
    records_loaded: written,
    duration_seconds: durationSeconds,
    logs: logs.join('\n'),
  });

  return Response.json({
    success: true,
    records: written,
    pr_url: prData.html_url,
    pr_number: prData.number,
    branch: prBranch,
    logs: logs.join('\n'),
  });
  } catch(err) {
    return Response.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
});