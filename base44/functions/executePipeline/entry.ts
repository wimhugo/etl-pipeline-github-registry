import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Parse CSV text into array of row objects
function parseCsv(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    // Handle quoted fields
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

// Build a record object by applying field_mapping directly (no JSON parse round-trip)
function applyMappingToObject(templateObj, fieldMapping, row) {
  const result = JSON.parse(JSON.stringify(templateObj)); // deep clone
  function fillObject(obj) {
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string') {
        const match = obj[key].match(/^{{(.+)}}$/);
        if (match) {
          const templateField = match[1];
          const sourceField = fieldMapping[templateField];
          obj[key] = sourceField !== undefined ? (row[sourceField] || '') : obj[key];
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
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { pipeline_id, github_token } = await req.json();
  const token = github_token || Deno.env.get('GITHUB_TOKEN');
  if (!token) return Response.json({ error: 'No GitHub token configured' }, { status: 400 });

  const pipelines = await base44.entities.Pipeline.filter({ id: pipeline_id });
  const pipeline = pipelines[0];
  if (!pipeline) return Response.json({ error: 'Pipeline not found' }, { status: 404 });

  const startedAt = new Date().toISOString();
  const logs = [];

  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'OpenREL-App',
  };

  const repo = pipeline.github_repo;
  const branch = pipeline.github_branch || 'main';
  const targetFolder = (pipeline.github_target_folder || 'data').replace(/\/$/, '');

  if (!repo) return Response.json({ error: 'No GitHub repo configured on pipeline' }, { status: 400 });
  if (!pipeline.source_file_url) return Response.json({ error: 'No source file configured' }, { status: 400 });
  if (!pipeline.template) return Response.json({ error: 'No template configured' }, { status: 400 });
  if (!pipeline.field_mapping || Object.keys(pipeline.field_mapping).length === 0) {
    return Response.json({ error: 'No field mappings configured' }, { status: 400 });
  }

  // 1. Fetch the source CSV
  logs.push('[INFO] Fetching source file...');
  const csvRes = await fetch(pipeline.source_file_url);
  if (!csvRes.ok) return Response.json({ error: 'Failed to fetch source file' }, { status: 500 });
  const csvText = await csvRes.text();
  const rows = parseCsv(csvText);
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

  if (pipeline.inventory_mode) {
    // Build array of all transformed records
    logs.push(`[INFO] Inventory mode: bundling ${rows.length} records into single file...`);
    let templateObj;
    try { templateObj = JSON.parse(pipeline.template); } catch(e) { templateObj = null; }
    const allRecords = rows.map(row =>
      templateObj
        ? applyMappingToObject(templateObj, pipeline.field_mapping, row)
        : JSON.parse(applyTemplate(pipeline.template, pipeline.field_mapping, row))
    );
    const filePath = `${targetFolder}/${pipeline.name.replace(/\s+/g, '_').toLowerCase()}.json`;
    const fileContent = JSON.stringify(allRecords, null, 2);

    let existingSha;
    const checkRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}?ref=${prBranch}`, { headers });
    if (checkRes.ok) { existingSha = (await checkRes.json()).sha; }

    const putBody = { message: `feat: update ${pipeline.name} inventory via openrel`, content: encodeBase64(fileContent), branch: prBranch };
    if (existingSha) putBody.sha = existingSha;

    const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      method: 'PUT', headers, body: JSON.stringify(putBody),
    });
    if (putRes.ok) { outputFiles.push(filePath); written = rows.length; }
    else { const err = await putRes.json(); logs.push(`[WARN] Failed to write inventory file: ${err.message}`); }

    logs.push(`[INFO] Written inventory file: ${filePath}`);
  } else {
    // One file per row
    logs.push(`[INFO] Writing ${rows.length} files to ${targetFolder}/...`);
    for (const row of rows) {
      const iriField = pipeline.field_mapping['openrel:IRI'] || Object.values(pipeline.field_mapping)[0];
      const iriValue = row[iriField] || `record-${written}`;
      const safeName = iriValue.replace(/^.*[/#]/, '').replace(/[^a-zA-Z0-9_\-\.]/g, '_') || `record-${written}`;
      const filePath = `${targetFolder}/${safeName}.json`;
      let templateObj2;
      try { templateObj2 = JSON.parse(pipeline.template); } catch(e) { templateObj2 = null; }
      const fileContent = templateObj2
        ? JSON.stringify(applyMappingToObject(templateObj2, pipeline.field_mapping, row), null, 2)
        : applyTemplate(pipeline.template, pipeline.field_mapping, row);

      let existingSha;
      const checkRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}?ref=${prBranch}`, { headers });
      if (checkRes.ok) { existingSha = (await checkRes.json()).sha; }

      const putBody = { message: `feat: add ${safeName} via openrel pipeline`, content: encodeBase64(fileContent), branch: prBranch };
      if (existingSha) putBody.sha = existingSha;

      const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
        method: 'PUT', headers, body: JSON.stringify(putBody),
      });
      if (putRes.ok) { outputFiles.push(filePath); written++; }
      else { const err = await putRes.json(); logs.push(`[WARN] Failed to write ${filePath}: ${err.message}`); }
    }
    logs.push(`[INFO] Written ${written} files`);
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
});