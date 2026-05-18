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
  let targetRepo = repo || globalConfig?.github_repo;
  const targetBranch = branch || globalConfig?.github_branch || 'main';

  // Clean repo value if it's a full URL
  if (targetRepo?.includes('github.com')) {
    const match = targetRepo.match(/github\.com\/([^/]+\/[^/]+)(?:\/|$)/);
    if (match) {
      targetRepo = match[1];
      console.log('Cleaned repo from URL to:', targetRepo);
    }
  }

  console.log('SubmitPolicyPR params:', { file_path, file_content, message, repo, branch, targetRepo, targetBranch });

  if (!targetRepo) {
    return Response.json({ error: 'No repository specified and no global config found' }, { status: 400 });
  }

  // If file_path doesn't start with http, it's a relative path - use it as-is
  const filePath = file_path.startsWith('http') ? file_path : file_path;

  // Clean file_path if it's a full URL
  let cleanFilePath = file_path;
  if (file_path.includes('github.com')) {
    // Extract path from raw URL: https://raw.githubusercontent.com/owner/repo/branch/path -> path
    const rawMatch = file_path.match(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/(.+)$/);
    if (rawMatch) {
      cleanFilePath = rawMatch[1];
    } else {
      // Extract path from browser URL: https://github.com/owner/repo/tree/branch/path -> path
      const browserMatch = file_path.match(/github\.com\/[^/]+\/[^/]+\/(?:tree|blob)\/[^/]+\/(.+)$/);
      if (browserMatch) {
        cleanFilePath = browserMatch[1];
      }
    }
    console.log('Cleaned file_path from URL to:', cleanFilePath);
  }

  // 1. Fetch the current file from GitHub API to get SHA and content (or detect if it doesn't exist)
  const apiBase = `https://api.github.com/repos/${targetRepo}/contents/${cleanFilePath}`;
  console.log('Fetching file from:', apiBase);
  const fileRes = await fetch(`${apiBase}?ref=${targetBranch}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  
  console.log('File fetch status:', fileRes.status);
  
  let sha = null;
  let existingContent = null;
  
  if (fileRes.ok) {
    const fileJson = await fileRes.json();
    sha = fileJson.sha;
    existingContent = JSON.parse(atob(fileJson.content.replace(/\n/g, '')));
    console.log('File exists, SHA:', sha);
  } else if (fileRes.status !== 404) {
    const err = await fileRes.text();
    console.error('File fetch error:', err);
    return Response.json({ error: `Failed to fetch file: ${err}` }, { status: 500 });
  } else {
    console.log('File does not exist yet (404), will create new');
  }

  // 2. Prepare the file content
  const updatedContent = btoa(unescape(encodeURIComponent(file_content)));

  // 3. Create a new branch for the PR
  console.log('Getting branch ref for:', targetBranch);
  const refRes = await fetch(`https://api.github.com/repos/${targetRepo}/git/ref/heads/${targetBranch}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  console.log('Branch ref status:', refRes.status);
  if (!refRes.ok) {
    const err = await refRes.text();
    console.error('Branch ref error:', err);
    return Response.json({ error: `Failed to get branch ref: ${err}` }, { status: 500 });
  }
  const refJson = await refRes.json();
  const baseSha = refJson.object.sha;
  console.log('Base SHA:', baseSha);

  const timestamp = Date.now();
  const safeName = file_path.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/\.json$/, '');
  const prBranch = `update-${safeName}-${timestamp}`;

  console.log('Creating branch:', prBranch);
  const branchRes = await fetch(`https://api.github.com/repos/${targetRepo}/git/refs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${prBranch}`, sha: baseSha }),
  });
  console.log('Branch creation status:', branchRes.status);
  if (!branchRes.ok) {
    const err = await branchRes.text();
    console.error('Branch creation error:', err);
    return Response.json({ error: `Failed to create branch: ${err}` }, { status: 500 });
  }

  // 4. Commit the updated file to the new branch
  console.log('Committing file to branch:', prBranch);
  const commitRes = await fetch(`https://api.github.com/repos/${targetRepo}/contents/${cleanFilePath}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: message || `Update ${cleanFilePath}`,
      content: updatedContent,
      sha: sha || undefined,
      branch: prBranch,
    }),
  });
  console.log('Commit status:', commitRes.status);
  if (!commitRes.ok) {
    const err = await commitRes.text();
    console.error('Commit error:', err);
    return Response.json({ error: `Failed to commit: ${err}` }, { status: 500 });
  }

  // 5. Open the pull request
  console.log('Creating PR from', prBranch, 'to', targetBranch);
  const prRes = await fetch(`https://api.github.com/repos/${targetRepo}/pulls`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `[Update] ${cleanFilePath}`,
      body: `Submitting update to "${cleanFilePath}" for review.\n\nChanges: ${message || 'Content update'}`,
      head: prBranch,
      base: targetBranch,
    }),
  });
  console.log('PR creation status:', prRes.status);
  if (!prRes.ok) {
    const err = await prRes.text();
    console.error('PR creation error:', err);
    return Response.json({ error: `Failed to create PR: ${err}` }, { status: 500 });
  }
  const prJson = await prRes.json();
  console.log('PR created:', prJson.html_url);

  return Response.json({ success: true, pr_url: prJson.html_url, pr_number: prJson.number });
});