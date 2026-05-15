import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { policy, policyFileUrl, repo, branch, filePath } = await req.json();
  const token = Deno.env.get('GITHUB_TOKEN');
  if (!token) return Response.json({ error: 'GITHUB_TOKEN not set' }, { status: 500 });

  // 1. Fetch the current file from GitHub API to get SHA and content
  const apiBase = `https://api.github.com/repos/${repo}/contents/${filePath}`;
  const fileRes = await fetch(`${apiBase}?ref=${branch}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!fileRes.ok) {
    const err = await fileRes.text();
    return Response.json({ error: `Failed to fetch file: ${err}` }, { status: 500 });
  }
  const fileJson = await fileRes.json();
  const sha = fileJson.sha;
  const decoded = JSON.parse(atob(fileJson.content.replace(/\n/g, '')));

  // 2. Append the new policy (with status set to pending)
  const pendingPolicy = { ...policy, status: 'openrel:status/pending' };
  const policiesArray = decoded.policies || (Array.isArray(decoded) ? decoded : []);
  policiesArray.push(pendingPolicy);
  if (decoded.policies !== undefined) {
    decoded.policies = policiesArray;
  }
  const updatedContent = btoa(unescape(encodeURIComponent(JSON.stringify(Array.isArray(decoded) ? policiesArray : decoded, null, 2))));

  // 3. Create a new branch for the PR
  // Get the SHA of the base branch tip
  const refRes = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/${branch}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!refRes.ok) return Response.json({ error: 'Failed to get branch ref' }, { status: 500 });
  const refJson = await refRes.json();
  const baseSha = refJson.object.sha;

  const prBranch = `policy-draft-${policy.id.replace(/[^a-zA-Z0-9_-]/g, '-')}-${Date.now()}`;

  const branchRes = await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
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
      message: `Add draft policy: ${policy.label}`,
      content: updatedContent,
      sha,
      branch: prBranch,
    }),
  });
  if (!commitRes.ok) {
    const err = await commitRes.text();
    return Response.json({ error: `Failed to commit: ${err}` }, { status: 500 });
  }

  // 5. Open the pull request
  const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `[Policy Draft] ${policy.label}`,
      body: `Submitting draft policy "${policy.label}" (${policy.id}) for review.\n\nDerived from: ${policy.derived_from || 'N/A'}`,
      head: prBranch,
      base: branch,
    }),
  });
  if (!prRes.ok) {
    const err = await prRes.text();
    return Response.json({ error: `Failed to create PR: ${err}` }, { status: 500 });
  }
  const prJson = await prRes.json();

  return Response.json({ success: true, pr_url: prJson.html_url, pr_number: prJson.number });
});