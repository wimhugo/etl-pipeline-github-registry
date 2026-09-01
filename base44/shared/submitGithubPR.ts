/**
 * submitGithubPR
 * --------------
 * Shared GitHub "create branch + commit file + open pull request" helper.
 * Used by submitPolicyPR (UI context) and indexPolicies (apply path) so the
 * PR logic lives in one place and there is no fragile function-to-function
 * service-role invoke.
 *
 * Pure GitHub I/O — no Base44 auth. Callers resolve the token/repo/branch
 * themselves (via resolveGithubCredentials) and pass them in.
 */

export interface SubmitPRParams {
  token: string;
  /** owner/repo, or a github.com URL (cleaned internally). */
  repo: string;
  /** base branch the PR targets (e.g. "main"). */
  branch: string;
  /** repository path to write (e.g. "data/input/policy_index.json"). */
  filePath: string;
  /** full new file content. */
  content: string;
  /** commit message + PR body description. */
  message: string;
  /** optional PR title (defaults to `[Update] <filePath>`). */
  prTitle?: string;
  /** optional PR branch prefix (defaults to "update"). */
  branchPrefix?: string;
}

export interface SubmitPRResult {
  pr_url: string;
  pr_number: number;
  branch: string;
}

function cleanRepo(repo: string): string {
  if (!repo) return repo;
  if (repo.includes('github.com')) {
    const m = repo.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?(?:\/|$)/);
    if (m) return m[1];
  }
  return repo.replace(/\.git$/, '');
}

export async function submitGithubPR(p: SubmitPRParams): Promise<SubmitPRResult> {
  const token = p.token;
  const repo = cleanRepo(p.repo);
  const branch = p.branch;
  const filePath = p.filePath;
  if (!token) throw new Error('No GitHub token provided');
  if (!repo) throw new Error('No repository provided');

  const H = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'OpenREL-App',
  };

  // 1. Fetch the existing file (for its SHA) on the base branch.
  let sha: string | null = null;
  const fRes = await fetch(
    `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(filePath)}?ref=${branch}`,
    { headers: H },
  );
  if (fRes.ok) {
    const fj = await fRes.json();
    sha = fj.sha ?? null;
  } else if (fRes.status !== 404) {
    const e = await fRes.text();
    throw new Error(`fetch file (${fRes.status}): ${e.slice(0, 200)}`);
  }

  // 2. Resolve the base branch ref to create the PR branch from.
  const refRes = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/${branch}`, { headers: H });
  if (!refRes.ok) {
    const e = await refRes.text();
    throw new Error(`fetch branch ref (${refRes.status}): ${e.slice(0, 200)}`);
  }
  const baseSha = (await refRes.json()).object.sha;

  const safeName = filePath.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/\.json$/, '');
  const prBranch = `${p.branchPrefix || 'update'}-${safeName}-${Date.now()}`;

  // 3. Create the PR branch.
  const brRes = await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${prBranch}`, sha: baseSha }),
  });
  if (!brRes.ok) {
    const e = await brRes.text();
    throw new Error(`create branch (${brRes.status}): ${e.slice(0, 200)}`);
  }

  // 4. Commit the file to the PR branch.
  const enc = btoa(unescape(encodeURIComponent(p.content)));
  const commitRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
    method: 'PUT',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: p.message || `Update ${filePath}`,
      content: enc,
      sha: sha || undefined,
      branch: prBranch,
    }),
  });
  if (!commitRes.ok) {
    const e = await commitRes.text();
    throw new Error(`commit file (${commitRes.status}): ${e.slice(0, 200)}`);
  }

  // 5. Open the pull request.
  const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: p.prTitle || `[Update] ${filePath}`,
      body: `Submitting update to "${filePath}" for review.\n\nChanges: ${p.message || 'Content update'}`,
      head: prBranch,
      base: branch,
    }),
  });
  if (!prRes.ok) {
    const e = await prRes.text();
    throw new Error(`create PR (${prRes.status}): ${e.slice(0, 200)}`);
  }
  const prJson = await prRes.json();
  return { pr_url: prJson.html_url, pr_number: prJson.number, branch: prBranch };
}