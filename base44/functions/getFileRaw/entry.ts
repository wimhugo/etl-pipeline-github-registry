import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { repo, path, branch = 'main', offset = 0, limit = 80000 } = body;

    const configs = await base44.asServiceRole.entities.GlobalConfig.list();
    const config = configs[0] || {};
    const token = config.github_token || Deno.env.get('GITHUB_TOKEN');

    const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}&_=${Date.now()}`;
    const resp = await fetch(apiUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3.raw',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });

    if (!resp.ok) return Response.json({ error: `GitHub ${resp.status}` }, { status: resp.status });

    const text = await resp.text();
    const chunk = text.slice(offset, offset + limit);

    return Response.json({
      total_length: text.length,
      offset,
      chunk_length: chunk.length,
      has_more: offset + limit < text.length,
      content: chunk
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});