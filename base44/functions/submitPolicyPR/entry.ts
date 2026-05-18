import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { file_path, file_content, message, repo, branch } = await req.json();
  const token = Deno.env.get('GITHUB_TOKEN');
  if (!token) return Response.json({ error: 'GITHUB_TOKEN not set' }, { status: 500 });

  // Use global config for repo/branch if not provided
  const globalConfigs = await base44.entities.GlobalConfig.list();
  const globalConfig = globalConfigs[0];
  const targetRepo = repo || globalConfig?.github_repo;
  const targetBranch = branch || globalConfig?.github_branch || 'main';

  if (!targetRepo) {
    return Response.json({ error: 'No repository specified and no global config found' }, { status: 400 });
  }

  // 1. Fetch the current file from GitHub API to get SHA and content (or detect if it doesn't exist)
  const apiBase = `https://api.github.com/repos/${targetRepo}/contents/${file_path}`;
  const fileRes = await fetch(`${apiBase}?ref=${targetBranch}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  
  let sha = null;
  let existingContent = null;
  
  if (fileRes.ok) {
    const fileJson = await fileRes.json();
    sha = fileJson.sha;
    existingContent = JSON.parse(atob(fileJson.content.replace(/\n/g, '')));
  } else if (fileRes.status !== 404) {
    const err = await fileRes.text();
    return Response.json({ error: `Failed to fetch file: ${err}` }, { status: 500 });
  }

  // 2. Prepare the file content
  const updatedContent = btoa(unescape(encodeURIComponent(file_content)));

  // 3. Create a new branch for the PR
  const refRes = await fetch(`https://api.github.com/repos/${targetRepo}/git/ref/heads/${targetBranch}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!refRes.ok) return Response.json({ error: 'Failed to get branch ref' }, { status: 500 });
  const refJson = await refRes.json();
  const baseSha = refJson.object.sha;

  const timestamp = Date.now();
  const safeName = file_path.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/\.json$/, '');
  const prBranch = `update-${safeName}-${timestamp}`;

  const branchRes = await fetch(`https://api.github.com/repos/${targetRepo}/git/refs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${prBranch}`, sha: baseSha }),
  });
  if (!branchRes.ok) {
    const err = await branchRes.text();
    return Response.json({ error: `Failed to create branch: ${err}` }, { status: 500 });
  }

  // 4. Commit the updated file to the new branch
  const commitRes = await fetch(apiBase, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: message || `Update ${file_path}`,
      content: updatedContent,
      sha: sha || undefined,
      branch: prBranch,
    }),
  });
  if (!commitRes.ok) {
    const err = await commitRes.text();
    return Response.json({ error: `Failed to commit: ${err}` }, { status: 500 });
  }

  // 5. Open the pull request
  const prRes = await fetch(`https://api.github.com/repos/${targetRepo}/pulls`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `[Update] ${file_path}`,
      body: `Submitting update to "${file_path}" for review.\n\nChanges: ${message || 'Content update'}`,
      head: prBranch,
      base: targetBranch,
    }),
  });
  if (!prRes.ok) {
    const err = await prRes.text();
    return Response.json({ error: `Failed to create PR: ${err}` }, { status: 500 });
  }
  const prJson = await prRes.json();

  return Response.json({ success: true, pr_url: prJson.html_url, pr_number: prJson.number });
});