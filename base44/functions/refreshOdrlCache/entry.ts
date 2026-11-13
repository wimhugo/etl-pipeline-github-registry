import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveGithubCredentials } from '../../shared/resolveGithubCredentials.ts';

/**
 * refreshOdrlCache
 * ----------------
 * On-demand refresh of the ODRL vocabulary cache.
 *
 * The W3C ODRL 2.2 vocabulary is mirrored in the repository at
 * model/vocabs/odrl/odrl.ttl so the ODRL API sections (ODRL Classes and
 * ODRL Individuals) can read it like any other source file. This function
 * fetches the upstream Turtle document and commits it to that path when it
 * differs from the cached copy.
 *
 * Body (all optional):
 *   { file_path, upstream_url, repo, branch }
 */

// The published copy at www.w3.org/ns/odrl/2/ODRL22.ttl sits behind a Cloudflare
// challenge that refuses server-side requests, so the refresh reads the same
// vocabulary from the W3C ODRL Working Group's own repository.
const DEFAULT_UPSTREAM_URL = 'https://raw.githubusercontent.com/w3c/poe/gh-pages/vocab/ODRL22.ttl';
const DEFAULT_CACHE_PATH = 'model/vocabs/odrl/odrl.ttl';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const filePath = body.file_path || DEFAULT_CACHE_PATH;
    const upstreamUrl = body.upstream_url || DEFAULT_UPSTREAM_URL;

    // 1. Fetch the upstream vocabulary.
    const upstream = await fetch(upstreamUrl, {
      // w3.org refuses requests without a client identifier.
      headers: {
        Accept: 'text/turtle',
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
      return Response.json({
        error: `Upstream fetch failed (${upstream.status} ${upstream.statusText})`,
        detail,
      }, { status: 502 });
    }
    const text = await upstream.text();
    // The W3C namespace resolves to an HTML landing page unless the Turtle
    // document itself is requested — refuse anything that is not Turtle.
    if (!/^\s*(@prefix|@base|PREFIX)/m.test(text) || !text.includes('www.w3.org/ns/odrl/2/')) {
      return Response.json({ error: 'Upstream response is not the ODRL Turtle vocabulary' }, { status: 502 });
    }

    // 2. Resolve GitHub credentials and the current cached copy.
    const { token, githubRepo, branch } = await resolveGithubCredentials(base44, {
      repo: body.repo,
      branch: body.branch,
    });
    if (!token) return Response.json({ error: 'No GitHub token configured' }, { status: 400 });

    const ghHeaders = {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'OpenREL-App',
    };

    const getRes = await fetch(
      `https://api.github.com/repos/${githubRepo}/contents/${filePath}?ref=${branch}&_=${Date.now()}`,
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
      const cached = new TextDecoder().decode(bytes);
      unchanged = cached.trim() === text.trim();
    } else if (getRes.status !== 404) {
      const errText = await getRes.text();
      return Response.json({ error: `GitHub GET ${getRes.status}: ${errText.substring(0, 200)}` }, { status: 502 });
    }

    if (unchanged) {
      return Response.json({
        status: 'unchanged',
        file_path: filePath,
        upstream_url: upstreamUrl,
        repo: githubRepo,
        branch,
        bytes: text.length,
      });
    }

    // 3. Commit the refreshed copy (UTF-8 safe base64 encoding).
    const encodedBytes = new TextEncoder().encode(text);
    let binaryString = '';
    for (let i = 0; i < encodedBytes.length; i++) binaryString += String.fromCharCode(encodedBytes[i]);
    const content = btoa(binaryString);

    const putBody = {
      message: `chore: refresh ODRL vocabulary cache from ${upstreamUrl}`,
      content,
      branch,
    };
    if (sha) putBody.sha = sha;

    const putRes = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${filePath}`, {
      method: 'PUT',
      headers: ghHeaders,
      body: JSON.stringify(putBody),
      signal: AbortSignal.timeout(20000),
    });
    const putData = await putRes.json().catch(() => ({}));
    if (!putRes.ok) {
      return Response.json({ error: `GitHub PUT ${putRes.status}: ${putData.message || ''}` }, { status: 502 });
    }

    return Response.json({
      status: 'updated',
      file_path: filePath,
      upstream_url: upstreamUrl,
      repo: githubRepo,
      branch,
      bytes: text.length,
      previous_bytes: previousBytes,
      commit_url: putData.commit?.html_url,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}