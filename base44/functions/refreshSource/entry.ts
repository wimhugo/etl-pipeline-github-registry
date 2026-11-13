import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { mirrorUpstreamFile } from '../../shared/mirrorUpstreamFile.ts';

/**
 * refreshSource
 * -------------
 * Runs one refresh task from the source registry (RefreshSource entity).
 *
 * Only sources whose refresh_handler is 'mirror_upstream' can be run here:
 * their upstream document is fetched and committed to the configured cache
 * path when it differs from the stored copy. Sources with handler 'none' are
 * produced outside the platform and are tracked only.
 *
 * Body: { source_id }
 * The outcome is written back to the source record so the dashboard cards
 * always show the state of the last attempt.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const sourceId = body.source_id;
    if (!sourceId) return Response.json({ error: 'source_id is required' }, { status: 400 });

    const source = await base44.asServiceRole.entities.RefreshSource
      .get(sourceId)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!source) return Response.json({ error: 'Source not found' }, { status: 404 });
    if (source.is_active === false) {
      return Response.json({ error: `"${source.name}" is inactive` }, { status: 400 });
    }
    if (source.refresh_handler !== 'mirror_upstream') {
      return Response.json({
        error: `"${source.name}" has no automated refresh — it is produced outside the platform`,
      }, { status: 400 });
    }
    if (!source.upstream_source || !source.cache_path) {
      return Response.json({
        error: 'Both an upstream source and a cache path are required to refresh this source',
      }, { status: 400 });
    }

    const mirror = await mirrorUpstreamFile({
      base44,
      upstreamUrl: source.upstream_source,
      cachePath: source.cache_path,
      commitMessage: `chore: refresh ${source.name} from upstream`,
    });

    const refreshedAt = new Date().toISOString();

    if (!mirror.ok) {
      await base44.asServiceRole.entities.RefreshSource.update(source.id, {
        last_refresh_at: refreshedAt,
        last_refresh_status: 'failed',
        last_refresh_message: mirror.error,
      });
      return Response.json({
        error: mirror.error,
        ...(mirror.detail ? { detail: mirror.detail } : {}),
      }, { status: mirror.status });
    }

    await base44.asServiceRole.entities.RefreshSource.update(source.id, {
      last_refresh_at: refreshedAt,
      last_refresh_status: mirror.status,
      last_refresh_message: mirror.status === 'updated'
        ? `Updated from upstream (${mirror.bytes} bytes)`
        : `Already current (${mirror.bytes} bytes)`,
    });

    return Response.json({
      status: mirror.status,
      name: source.name,
      file_path: mirror.filePath,
      upstream_url: mirror.upstreamUrl,
      bytes: mirror.bytes,
      commit_url: mirror.commitUrl,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}