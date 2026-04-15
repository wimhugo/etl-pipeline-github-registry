import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CONNECTOR_ID = "69df39dd7a73e4638d15ccef";

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, repo, branch = 'main', path, content, message, sha } = body;

  const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(CONNECTOR_ID);
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  if (action === 'listRepos') {
    const res = await fetch('https://api.github.com/user/repos?per_page=50&sort=updated', { headers });
    const data = await res.json();
    if (!res.ok) return Response.json({ error: data.message }, { status: res.status });
    return Response.json({ repos: data.map(r => ({ full_name: r.full_name, default_branch: r.default_branch })) });
  }

  if (action === 'listFolder') {
    const url = `https://api.github.com/repos/${repo}/contents/${path || ''}?ref=${branch}`;
    const res = await fetch(url, { headers });
    const data = await res.json();
    if (!res.ok) return Response.json({ error: data.message }, { status: res.status });
    const items = Array.isArray(data) ? data : [data];
    return Response.json({ items: items.map(i => ({ name: i.name, path: i.path, type: i.type, sha: i.sha })) });
  }

  if (action === 'getFile') {
    const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`;
    const res = await fetch(url, { headers });
    const data = await res.json();
    if (!res.ok) return Response.json({ error: data.message }, { status: res.status });
    const decoded = atob(data.content.replace(/\n/g, ''));
    return Response.json({ content: decoded, sha: data.sha });
  }

  if (action === 'putFile') {
    // Create or update a file in GitHub
    const url = `https://api.github.com/repos/${repo}/contents/${path}`;
    const encoded = btoa(unescape(encodeURIComponent(content)));
    const body2 = { message: message || `chore: update ${path}`, content: encoded, branch };
    if (sha) body2.sha = sha; // needed for updates
    const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body2) });
    const data = await res.json();
    if (!res.ok) return Response.json({ error: data.message }, { status: res.status });
    return Response.json({ sha: data.content?.sha, url: data.content?.html_url });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
});