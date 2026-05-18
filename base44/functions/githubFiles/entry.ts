import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  console.log('📥 githubFiles called, method:', req.method);
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  console.log('👤 User:', user?.email || 'no user');
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  console.log('📦 Request body action:', body.action);
  const { action, repo, branch = 'main', path, content, message, sha, github_token } = body;

  // Use token from request if provided, otherwise use service role to fetch from GlobalConfig
  let token = github_token;
  console.log('🔍 Token from request:', github_token ? 'provided (first 8: ' + github_token.substring(0, 8) + '...)' : 'not provided');
  
  if (!token) {
    try {
      // Use service role to ensure we can read GlobalConfig
      const configs = await base44.asServiceRole.entities.GlobalConfig.filter({});
      console.log('📊 GlobalConfig count:', configs?.length || 0);
      if (configs && configs.length > 0 && configs[0].github_token) {
        token = configs[0].github_token;
        console.log('✅ Using GitHub token from GlobalConfig (first 8 chars):', token.substring(0, 8) + '...');
      } else {
        console.log('⚠️ No GitHub token found in GlobalConfig. Available fields:', configs?.[0] ? Object.keys(configs[0]) : 'no configs');
      }
    } catch (e) {
      console.log('⚠️ Could not fetch GlobalConfig:', e.message, e.stack);
    }
  }
  if (!token) {
    token = Deno.env.get('GITHUB_TOKEN');
    console.log('ℹ️ Using GitHub token from environment variable (first 8 chars):', token ? token.substring(0, 8) + '...' : 'not set');
  }
  if (!token) return Response.json({ error: 'No GitHub token configured' }, { status: 400 });
  
  console.log('🔑 Final token (first 8 chars):', token.substring(0, 8) + '...');

  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'OpenREL-App',
  };

  if (action === 'listRepos') {
    const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', { headers });
    const data = await res.json();
    if (!res.ok) return Response.json({ error: data.message }, { status: res.status });
    return Response.json({ repos: data.map(r => ({ full_name: r.full_name, default_branch: r.default_branch })) });
  }
  
  if (action === 'testToken') {
    // Test the token by fetching the authenticated user
    const res = await fetch('https://api.github.com/user', { headers });
    const data = await res.json();
    if (!res.ok) return Response.json({ error: data.message, status: res.status });
    return Response.json({ user: data.login, repos_url: data.repos_url });
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
    console.log('🌐 Fetching URL:', url);
    console.log('🔑 Authorization header:', headers.Authorization);
    const res = await fetch(url, { headers });
    console.log('📡 Response status:', res.status, res.statusText);
    const data = await res.json();
    console.log('📦 Response data:', JSON.stringify(data).substring(0, 200));
    if (!res.ok) return Response.json({ error: data.message }, { status: res.status });
    const decoded = atob(data.content.replace(/\n/g, ''));
    return Response.json({ content: decoded, sha: data.sha });
  }

  if (action === 'putFile') {
    const url = `https://api.github.com/repos/${repo}/contents/${path}`;
    const encoded = btoa(unescape(encodeURIComponent(content)));
    const putBody = { message: message || `chore: update ${path}`, content: encoded, branch };
    if (sha) putBody.sha = sha;
    const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(putBody) });
    const data = await res.json();
    if (!res.ok) return Response.json({ error: data.message }, { status: res.status });
    return Response.json({ sha: data.content?.sha, url: data.content?.html_url });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
});