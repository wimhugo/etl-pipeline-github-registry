/**
 * Resolves GitHub credentials from GlobalConfig and Project entities.
 *
 * Backend functions need GitHub tokens, but users may save them to either
 * GlobalConfig (no active project) or a Project entity (when a project is
 * active in V0.4 Settings). This helper checks ALL sources and returns the
 * most recently updated credentials, ensuring backend functions always use
 * the latest token regardless of where it was saved.
 *
 * Usage:
 *   import { resolveGithubCredentials } from '../../shared/resolveGithubCredentials.ts';
 *   const { token, githubRepo, branch } = await resolveGithubCredentials(base44);
 */

export async function resolveGithubCredentials(base44, overrides = {}) {
  // Allow caller overrides (e.g. when repo/branch is passed explicitly)
  const overrideRepo = overrides.repo;
  const overrideBranch = overrides.branch;

  // 1. Collect credential candidates from GlobalConfig + all Projects
  const candidates = [];

  const configs = await base44.asServiceRole.entities.GlobalConfig.list();
  const globalConfig = configs[0] || {};
  if (globalConfig.github_token) {
    candidates.push({
      token: globalConfig.github_token,
      repo: globalConfig.github_repo,
      branch: globalConfig.github_branch,
      updated: globalConfig.updated_date || '',
    });
  }

  const projects = await base44.asServiceRole.entities.Project.list();
  for (const p of projects) {
    if (p.github_token) {
      candidates.push({
        token: p.github_token,
        repo: p.github_repo,
        branch: p.github_branch,
        updated: p.updated_date || '',
      });
    }
  }

  // 2. Use the most recently updated credentials
  candidates.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
  const best = candidates[0] || {};

  return {
    token: best.token || Deno.env.get('GITHUB_TOKEN'),
    githubRepo: overrideRepo || best.repo || globalConfig.github_repo || 'wimhugo/openrel',
    branch: overrideBranch || best.branch || globalConfig.github_branch || 'main',
    source: best.token ? (best.updated ? 'stored' : 'env') : 'env',
  };
}