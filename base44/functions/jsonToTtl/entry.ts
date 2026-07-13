import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * jsonToTtl
 * --------
 * One-off ETL function that converts a JSON input (inline text or fetched from
 * a URL) into RDF Turtle (TTL), then writes the result to a target file in a
 * GitHub repository.
 *
 * The JSON input is expected to contain IRIs and properties that are faithfully
 * serialized as TTL triples.  Supported JSON shapes:
 *   - JSON-LD: { "@context": { ... }, "@graph": [ ... ] }
 *   - Array of member objects
 *   - Single object with @id / id / iri
 *   - Wrapper object with items/members/policies/concepts array
 *
 * Each member object's keys become predicates; values become objects.
 * CURIEs (e.g. "skos:prefLabel") and full IRIs are preserved as-is.
 *
 * Usage:
 *   base44.functions.invoke('jsonToTtl', { config_id: '<entity id>' })
 *   base44.functions.invoke('jsonToTtl', { config_id: '<entity id>', preview: true })
 *   base44.functions.invoke('jsonToTtl', { json_text: '...', target_folder: '...', target_file: '...', preview: true })
 *
 * GitHub credentials (token, repo, branch) are resolved from GlobalConfig.
 * Each config specifies its own target_folder and target_file.
 */

const STANDARD_PREFIXES: Record<string, string> = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  odrl: 'http://www.w3.org/ns/odrl/2/',
  dcterms: 'http://purl.org/dc/terms/',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  openrel: 'https://openrel.org/ns#',
};

function escapeLiteral(str: string): string {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function isIri(val: any): boolean {
  return typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'));
}

function isCurie(val: any): boolean {
  return typeof val === 'string' && val.includes(':') && !isIri(val) && !val.startsWith('"');
}

function jsonToTtl(jsonText: string, defaultNamespace: string): string {
  const data = JSON.parse(jsonText);

  let prefixes: Record<string, string> = {};
  let items: any[] = [];

  if (Array.isArray(data)) {
    items = data;
  } else if (data['@graph'] && Array.isArray(data['@graph'])) {
    if (data['@context'] && typeof data['@context'] === 'object' && !Array.isArray(data['@context'])) {
      prefixes = { ...data['@context'] };
    }
    items = data['@graph'];
  } else if (typeof data === 'object' && data !== null) {
    if (data['@context'] && typeof data['@context'] === 'object' && !Array.isArray(data['@context'])) {
      prefixes = { ...data['@context'] };
    }
    if (data['@id'] || data['id'] || data['iri']) {
      items = [data];
    } else {
      for (const key of ['items', 'members', 'policies', 'concepts', 'values']) {
        if (Array.isArray(data[key])) { items = data[key]; break; }
      }
      if (items.length === 0) items = [data];
    }
  }

  // Merge standard prefixes (don't override @context ones)
  for (const [p, ns] of Object.entries(STANDARD_PREFIXES)) {
    if (!prefixes[p]) prefixes[p] = ns;
  }
  // Add default namespace if not present
  if (defaultNamespace && !prefixes[defaultNamespace]) {
    prefixes[defaultNamespace] = STANDARD_PREFIXES[defaultNamespace] || `https://openrel.org/ns#`;
  }

  // Auto-detect prefixes used in CURIEs (recursively traverses nested objects)
  function collectPrefix(term: any) {
    if (typeof term === 'string') {
      const colonIdx = term.indexOf(':');
      if (colonIdx > 0) {
        const prefix = term.substring(0, colonIdx);
        if (!prefixes[prefix] && STANDARD_PREFIXES[prefix]) {
          prefixes[prefix] = STANDARD_PREFIXES[prefix];
        }
      }
    } else if (Array.isArray(term)) {
      term.forEach(collectPrefix);
    } else if (typeof term === 'object' && term !== null) {
      for (const [k, v] of Object.entries(term)) {
        collectPrefix(k);
        collectPrefix(v);
      }
    }
  }

  for (const item of items) {
    collectPrefix(item);
  }

  function formatPredicate(pred: string): string {
    if (isIri(pred)) {
      for (const [prefix, ns] of Object.entries(prefixes)) {
        if (pred.startsWith(ns)) return `${prefix}:${pred.substring(ns.length)}`;
      }
      return `<${pred}>`;
    }
    return pred;
  }

  function serializeValue(val: any, indent: string): string {
    if (val === null || val === undefined) return '""';
    if (typeof val === 'number' || typeof val === 'boolean') {
      const s = String(val);
      return isCurie(s) ? s : `"${escapeLiteral(s)}"`;
    }
    if (typeof val === 'string') {
      if (isIri(val)) {
        for (const [prefix, ns] of Object.entries(prefixes)) {
          if (val.startsWith(ns)) return `${prefix}:${val.substring(ns.length)}`;
        }
        return `<${val}>`;
      }
      if (isCurie(val)) return val;
      return `"${escapeLiteral(val)}"`;
    }
    if (Array.isArray(val)) {
      const parts = val
        .filter((v) => v !== null && v !== undefined)
        .map((v) => serializeValue(v, indent));
      return parts.join(', ');
    }
    if (typeof val === 'object') {
      // If the nested object has an @id, reference it by IRI (it should be defined elsewhere as a top-level subject)
      const iri = val['@id'] || val['id'] || val['iri'];
      if (iri) {
        return isIri(iri) ? `<${iri}>` : iri;
      }
      // Otherwise, create a recursive blank node
      return serializeBlankNode(val, indent);
    }
    return `"${escapeLiteral(String(val))}"`;
  }

  function serializeBlankNode(obj: Record<string, any>, indent: string): string {
    const innerIndent = indent + '    ';
    const parts: string[] = [];

    for (const [key, val] of Object.entries(obj)) {
      if (['@id', 'id', 'iri'].includes(key)) continue;
      const pred = key === '@type' ? 'rdf:type' : key;
      const predDisplay = formatPredicate(pred);
      const values = Array.isArray(val) ? val : [val];
      for (const v of values) {
        if (v === null || v === undefined) continue;
        parts.push(`${innerIndent}${predDisplay} ${serializeValue(v, innerIndent)}`);
      }
    }

    if (parts.length === 0) return '[]';
    return `[\n${parts.join(' ;\n')}\n${indent}]`;
  }

  const lines: string[] = [];

  // @prefix declarations
  for (const [prefix, ns] of Object.entries(prefixes)) {
    lines.push(`@prefix ${prefix}: <${ns}> .`);
  }
  lines.push('');

  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const iri = item['@id'] || item['id'] || item['iri'] || '';
    if (!iri) continue;

    const subject = isIri(iri) ? `<${iri}>` : iri;
    const parts: string[] = [];

    for (const [key, val] of Object.entries(item)) {
      if (['@id', 'id', 'iri'].includes(key)) continue;

      const pred = key === '@type' ? 'rdf:type' : key;
      const predDisplay = formatPredicate(pred);

      const values = Array.isArray(val) ? val : [val];
      for (const v of values) {
        if (v === null || v === undefined) continue;
        parts.push(`    ${predDisplay} ${serializeValue(v, '    ')}`);
      }
    }

    if (parts.length > 0) {
      lines.push(subject);
      for (let i = 0; i < parts.length; i++) {
        lines.push(`${parts[i]}${i < parts.length - 1 ? ' ;' : ' .'}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { config_id, preview = false, json_text, target_folder, target_file, branch } = body;

    // Resolve config
    let config: any = null;
    if (config_id) {
      config = await base44.asServiceRole.entities.JsonPolicyParser.get(config_id);
      if (!config) {
        return Response.json({ error: 'Configuration not found' }, { status: 404 });
      }
    } else {
      // Inline mode — build a transient config from parameters
      config = {
        name: 'inline',
        input_type: 'text',
        json_text: json_text || '',
        github_target_folder: target_folder || '',
        github_target_file: target_file || '',
        github_branch: branch || 'main',
        namespace: 'openrel',
      };
    }

    if (!config.is_active && config_id) {
      return Response.json({ error: 'Configuration is inactive' }, { status: 410 });
    }

    // Gather JSON input
    let jsonText = '';
    if (config.input_type === 'file') {
      if (!config.input_file_url) {
        return Response.json({ error: 'No input file URL configured' }, { status: 400 });
      }
      const fetchResp = await fetch(config.input_file_url, {
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      });
      if (!fetchResp.ok) {
        const errText = await fetchResp.text();
        return Response.json({ error: `Failed to fetch input file (${fetchResp.status}): ${errText.substring(0, 200)}` }, { status: 502 });
      }
      jsonText = await fetchResp.text();
    } else {
      jsonText = config.json_text || '';
    }

    if (!jsonText.trim()) {
      return Response.json({ error: 'No JSON input provided' }, { status: 400 });
    }

    // Convert JSON to TTL
    let ttlContent: string;
    try {
      ttlContent = jsonToTtl(jsonText, config.namespace || 'openrel');
    } catch (e) {
      return Response.json({ error: `JSON to TTL conversion failed: ${e.message}` }, { status: 422 });
    }

    // Preview mode — return TTL without writing to GitHub
    if (preview) {
      return Response.json({
        status: 'success',
        config_name: config.name,
        ttl_preview: ttlContent,
        ttl_length: ttlContent.length,
      });
    }

    // Validate target path
    if (!config.github_target_folder || !config.github_target_file) {
      return Response.json({ error: 'Target folder and file must be specified in the configuration' }, { status: 400 });
    }

    // Resolve GitHub credentials from GlobalConfig
    const configs = await base44.asServiceRole.entities.GlobalConfig.list();
    const gc = configs[0] || {};
    const token = gc.github_token || Deno.env.get('GITHUB_TOKEN');
    const githubRepo = gc.github_repo || 'wimhugo/openrel';
    const ghBranch = config.github_branch || gc.github_branch || 'main';

    if (!token) {
      return Response.json({ error: 'No GitHub token configured in Settings' }, { status: 400 });
    }

    const targetPath = `${config.github_target_folder.replace(/^\/+|\/+$/g, '')}/${config.github_target_file}`;

    const ghHeaders = {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'OpenREL-App',
    };

    // Check if file exists on the base branch (to get SHA for update)
    const getUrl = `https://api.github.com/repos/${githubRepo}/contents/${targetPath}?ref=${ghBranch}`;
    const getResp = await fetch(getUrl, { headers: ghHeaders });

    let existingSha: string | null = null;
    if (getResp.ok) {
      const fileData = await getResp.json();
      existingSha = fileData.sha;
    } else if (getResp.status !== 404) {
      const errText = await getResp.text();
      return Response.json({ error: `GitHub GET ${getResp.status}: ${errText.substring(0, 200)}` }, { status: 502 });
    }

    // 1. Get the base branch ref SHA (for creating a new branch)
    const refResp = await fetch(`https://api.github.com/repos/${githubRepo}/git/ref/heads/${ghBranch}`, { headers: ghHeaders });
    if (!refResp.ok) {
      const errText = await refResp.text();
      return Response.json({ error: `Failed to get base branch ref: ${errText.substring(0, 200)}` }, { status: 502 });
    }
    const refJson = await refResp.json();
    const baseSha = refJson.object.sha;

    // 2. Create a new branch for the PR
    const timestamp = Date.now();
    const safeName = config.name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase().substring(0, 40);
    const prBranch = `json-ttl-${safeName}-${timestamp}`;

    const branchResp = await fetch(`https://api.github.com/repos/${githubRepo}/git/refs`, {
      method: 'POST',
      headers: ghHeaders,
      body: JSON.stringify({ ref: `refs/heads/${prBranch}`, sha: baseSha }),
    });
    if (!branchResp.ok) {
      const errText = await branchResp.text();
      return Response.json({ error: `Failed to create branch: ${errText.substring(0, 200)}` }, { status: 502 });
    }

    // 3. Commit the TTL file to the new branch
    const putBody: any = {
      message: `chore: JSON-to-TTL pipeline — ${config.name}`,
      content: btoa(unescape(encodeURIComponent(ttlContent))),
      branch: prBranch,
    };
    if (existingSha) putBody.sha = existingSha;

    const putUrl = `https://api.github.com/repos/${githubRepo}/contents/${targetPath}`;
    const putResp = await fetch(putUrl, { method: 'PUT', headers: ghHeaders, body: JSON.stringify(putBody) });
    const putData = await putResp.json();

    if (!putResp.ok) {
      if (config_id) {
        await base44.asServiceRole.entities.JsonPolicyParser.update(config_id, {
          last_run_at: new Date().toISOString(),
          last_run_status: 'failed',
          last_run_message: `GitHub PUT ${putResp.status}: ${putData.message || ''}`.substring(0, 500),
        });
      }
      return Response.json({ error: `GitHub PUT ${putResp.status}: ${putData.message || ''}` }, { status: 502 });
    }

    // 4. Open the pull request
    const prResp = await fetch(`https://api.github.com/repos/${githubRepo}/pulls`, {
      method: 'POST',
      headers: ghHeaders,
      body: JSON.stringify({
        title: `[JSON-to-TTL] ${config.name}`,
        body: `Converted JSON input to RDF Turtle and wrote to \`${targetPath}\`.\n\n**Pipeline:** ${config.name}\n**Target:** \`${githubRepo}:${targetPath}\`\n**TTL size:** ${ttlContent.length} bytes\n\nReview and merge to update the vocabulary.`,
        head: prBranch,
        base: ghBranch,
      }),
    });
    const prData = await prResp.json();

    if (!prResp.ok) {
      if (config_id) {
        await base44.asServiceRole.entities.JsonPolicyParser.update(config_id, {
          last_run_at: new Date().toISOString(),
          last_run_status: 'failed',
          last_run_message: `PR creation failed ${prResp.status}: ${prData.message || ''}`.substring(0, 500),
        });
      }
      return Response.json({ error: `Failed to create PR: ${prData.message || ''}` }, { status: 502 });
    }

    const prUrl = prData.html_url;

    // Update config with success
    if (config_id) {
      await base44.asServiceRole.entities.JsonPolicyParser.update(config_id, {
        last_run_at: new Date().toISOString(),
        last_run_status: 'success',
        last_run_message: `PR #${prData.number} created — ${ttlContent.length} bytes to ${targetPath}`,
        last_pr_url: prUrl,
      });
    }

    return Response.json({
      status: 'success',
      config_name: config.name,
      target_path: targetPath,
      target_repo: githubRepo,
      target_branch: ghBranch,
      pr_branch: prBranch,
      pr_url: prUrl,
      pr_number: prData.number,
      file_sha: putData.content?.sha,
      ttl_length: ttlContent.length,
      ttl_preview: ttlContent.substring(0, 1000),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});