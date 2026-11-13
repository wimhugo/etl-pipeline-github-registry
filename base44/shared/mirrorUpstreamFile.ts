import { resolveGithubCredentials } from './resolveGithubCredentials.ts';

export interface MirrorOptions {
  base44: any;
  upstreamUrl: string;
  cachePath: string;
  repo?: string;
  branch?: string;
  accept?: string;
  commitMessage?: string;
  // Returns an error message when the fetched document is not the expected kind.
  validate?: (text: string) => string | null;
}

export type MirrorOutcome =
  | {
      ok: true;
      status: 'updated' | 'unchanged';
      filePath: string;
      upstreamUrl: string;
      repo: string;
      branch: string;
      bytes: number;
      previousBytes: number;
      commitUrl: string | null;
    }
  | { ok: false; status: number; error: string; detail?: string };

/**
 * Fetches an upstream document and mirrors it to a repository path, committing
 * only when the content differs from the stored copy. Used by the ODRL cache
 * refresh and by the source registry's refresh tasks.
 */
export async function mirrorUpstreamFile(options: MirrorOptions): Promise<MirrorOutcome> {
  const { base44, upstreamUrl, cachePath } = options;

  const upstream = await fetch(upstreamUrl, {
    headers: {
      Accept: options.accept || 'text/plain',
      'User-Agent': 'OpenREL-App/0.4 (+https://openrel-platform-poc.base44.app)',
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!upstream.ok) {
    const detail = (await upstream.text().catch(() => ''))
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
    return {
      ok: false,
      status: 502,
      error: `Upstream fetch failed (${upstream.status} ${upstream.statusText})`,
      detail,
    };
  }

  const text = await upstream.text();

  const invalid = options.validate
    ? options.validate(text)
    : (/^\s*<(?:!doctype|html)/i.test(text) ? 'Upstream response is an HTML page, not the source document' : null);
  if (invalid) return { ok: false, status: 502, error: invalid };

  const { token, githubRepo, branch } = await resolveGithubCredentials(base44, {
    repo: options.repo,
    branch: options.branch,
  });
  if (!token) return { ok: false, status: 400, error: 'No GitHub token configured' };

  const ghHeaders = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'OpenREL-App',
  };

  const getRes = await fetch(
    `https://api.github.com/repos/${githubRepo}/contents/${cachePath}?ref=${branch}&_=${Date.now()}`,
    { headers: ghHeaders, signal: AbortSignal.timeout(15000) },
  );

  let sha = null;
  let previousBytes = 0;
  let unchanged = false;

  if (getRes.ok) {
    const file = await getRes.json();
    sha = file.sha;
    previousBytes = file.size || 0;
    const binary = atob(String(file.content || '').replace(/\n/g, ''));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    unchanged = new TextDecoder().decode(bytes).trim() === text.trim();
  } else if (getRes.status !== 404) {
    const errText = await getRes.text();
    return { ok: false, status: 502, error: `GitHub GET ${getRes.status}: ${errText.substring(0, 200)}` };
  }

  const base = {
    ok: true as const,
    filePath: cachePath,
    upstreamUrl,
    repo: githubRepo,
    branch,
    bytes: text.length,
    previousBytes,
  };

  if (unchanged) return { ...base, status: 'unchanged', commitUrl: null };

  // Commit the refreshed copy (UTF-8 safe base64 encoding).
  const encodedBytes = new TextEncoder().encode(text);
  let binaryString = '';
  for (let i = 0; i < encodedBytes.length; i++) binaryString += String.fromCharCode(encodedBytes[i]);
  const content = btoa(binaryString);

  const putBody: Record<string, any> = {
    message: options.commitMessage || `chore: refresh ${cachePath} from ${upstreamUrl}`,
    content,
    branch,
  };
  if (sha) putBody.sha = sha;

  const putRes = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${cachePath}`, {
    method: 'PUT',
    headers: ghHeaders,
    body: JSON.stringify(putBody),
    signal: AbortSignal.timeout(20000),
  });
  const putData = await putRes.json().catch(() => ({}));
  if (!putRes.ok) {
    return { ok: false, status: 502, error: `GitHub PUT ${putRes.status}: ${putData.message || ''}` };
  }

  return { ...base, status: 'updated', commitUrl: putData.commit?.html_url || null };
}