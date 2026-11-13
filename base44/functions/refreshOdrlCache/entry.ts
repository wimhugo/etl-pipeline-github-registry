import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { mirrorUpstreamFile } from '../../shared/mirrorUpstreamFile.ts';

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

    const mirror = await mirrorUpstreamFile({
      base44,
      upstreamUrl,
      cachePath: filePath,
      repo: body.repo,
      branch: body.branch,
      accept: 'text/turtle',
      commitMessage: `chore: refresh ODRL vocabulary cache from ${upstreamUrl}`,
      // The W3C namespace resolves to an HTML landing page unless the Turtle
      // document itself is requested — refuse anything that is not Turtle.
      validate: (text) => (
        /^\s*(@prefix|@base|PREFIX)/m.test(text) && text.includes('www.w3.org/ns/odrl/2/')
          ? null
          : 'Upstream response is not the ODRL Turtle vocabulary'
      ),
    });

    if (!mirror.ok) {
      return Response.json({
        error: mirror.error,
        ...(mirror.detail ? { detail: mirror.detail } : {}),
      }, { status: mirror.status });
    }

    const base = {
      file_path: mirror.filePath,
      upstream_url: mirror.upstreamUrl,
      repo: mirror.repo,
      branch: mirror.branch,
      bytes: mirror.bytes,
    };

    if (mirror.status === 'unchanged') {
      return Response.json({ status: 'unchanged', ...base });
    }

    return Response.json({
      status: 'updated',
      ...base,
      previous_bytes: mirror.previousBytes,
      commit_url: mirror.commitUrl,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}