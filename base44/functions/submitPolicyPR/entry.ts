import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { resolveGithubCredentials } from '../../shared/resolveGithubCredentials.ts';
import { submitGithubPR } from '../../shared/submitGithubPR.ts';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { file_path, file_content, message, repo, branch } = await req.json();
  const creds = await resolveGithubCredentials(base44, { repo, branch });
  if (!creds.token) return Response.json({ error: 'No GitHub token configured' }, { status: 500 });
  if (!creds.githubRepo) {
    return Response.json({ error: 'No repository specified and no global config found' }, { status: 400 });
  }

  // Clean file_path if a full GitHub URL was passed.
  let cleanFilePath = file_path;
  if (file_path.includes('github.com')) {
    const rawMatch = file_path.match(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/(.+)$/);
    if (rawMatch) {
      cleanFilePath = rawMatch[1];
    } else {
      const browserMatch = file_path.match(/github\.com\/[^/]+\/[^/]+\/(?:tree|blob)\/[^/]+\/(.+)$/);
      if (browserMatch) cleanFilePath = browserMatch[1];
    }
  }

  try {
    const result = await submitGithubPR({
      token: creds.token,
      repo: creds.githubRepo,
      branch: creds.branch,
      filePath: cleanFilePath,
      content: file_content,
      message,
    });
    return Response.json({ success: true, pr_url: result.pr_url, pr_number: result.pr_number, branch: result.branch });
  } catch (e) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
});