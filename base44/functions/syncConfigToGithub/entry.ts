import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function toYaml(obj, indent = 0) {
  const pad = ' '.repeat(indent);
  let out = '';
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'object' && !Array.isArray(v)) {
      out += `${pad}${k}:\n${toYaml(v, indent + 2)}`;
    } else if (Array.isArray(v)) {
      out += `${pad}${k}:\n`;
      for (const item of v) {
        if (typeof item === 'string') out += `${pad}  - ${item}\n`;
        else out += `${pad}  -\n${toYaml(item, indent + 4)}`;
      }
    } else if (typeof v === 'string' && v.includes('\n')) {
      out += `${pad}${k}: |\n${v.split('\n').map(l => `${pad}  ${l}`).join('\n')}\n`;
    } else {
      out += `${pad}${k}: ${JSON.stringify(v)}\n`;
    }
  }
  return out;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { pipeline_id, repo, branch = 'main', configs_folder = '.openrel/pipelines', github_token } = await req.json();

  const token = github_token || Deno.env.get('GITHUB_TOKEN');
  if (!token) return Response.json({ error: 'No GitHub token configured' }, { status: 400 });

  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'OpenREL-App',
  };

  const pipelines = await base44.entities.Pipeline.filter({ id: pipeline_id });
  const pipeline = pipelines[0];
  if (!pipeline) return Response.json({ error: 'Pipeline not found' }, { status: 404 });

  const configObj = {
    name: pipeline.name,
    description: pipeline.description || '',
    namespace: pipeline.namespace || 'openrel',
    source: {
      type: pipeline.source_type,
      file: pipeline.source_file_name,
      fields: pipeline.source_fields || [],
    },
    template: {
      file: pipeline.template_file_name,
      fields: pipeline.template_fields || [],
    },
    mapping: pipeline.field_mapping || {},
    github: {
      repo: pipeline.github_repo || repo,
      branch: pipeline.github_branch || branch,
      target_folder: pipeline.github_target_folder || '',
    },
    schedule: pipeline.schedule || 'manual',
  };

  const yamlContent = `# OpenREL Pipeline Config\n# Auto-generated\n\n${toYaml(configObj)}`;
  const filePath = `${configs_folder}/${pipeline.name.replace(/\s+/g, '-').toLowerCase()}.yaml`;
  const encoded = btoa(unescape(encodeURIComponent(yamlContent)));

  let sha;
  const checkRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`, { headers });
  if (checkRes.ok) {
    const existing = await checkRes.json();
    sha = existing.sha;
  }

  const putBody = { message: `chore: sync openrel pipeline config for ${pipeline.name}`, content: encoded, branch };
  if (sha) putBody.sha = sha;

  const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(putBody),
  });
  const putData = await putRes.json();
  if (!putRes.ok) return Response.json({ error: putData.message }, { status: putRes.status });

  await base44.asServiceRole.entities.Pipeline.update(pipeline_id, {
    github_config_path: filePath,
    github_repo: repo,
    github_branch: branch,
  });

  return Response.json({ success: true, path: filePath, url: putData.content?.html_url });
});