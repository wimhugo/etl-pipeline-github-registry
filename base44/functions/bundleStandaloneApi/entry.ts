import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveGithubCredentials } from '../../shared/resolveGithubCredentials.ts';
import { buildZip, toBase64 } from '../../shared/zipStore.ts';

/**
 * bundleStandaloneApi
 * -------------------
 * Builds a downloadable ZIP of the offline API demo:
 *
 *   index.html, lib/*, README.md   (served from public/odrel-api-demo)
 *   manifest.json                  (endpoints + section → file map)
 *   input/…                        every source file the API sections read
 *
 * The demo answers requests in the browser, so the bundle needs no server.
 */

const DEMO_DIR = 'odrel-api-demo';
const DEMO_ASSETS = ['index.html', 'lib/rdf.js', 'lib/mockApi.js', 'README.md'];
const FALLBACK_ORIGIN = 'https://openrel-platform-poc.base44.app';
const MAX_FILES = 400;
const FETCH_BATCH = 6;

function githubHeaders(token: string) {
  return {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3.raw',
    'User-Agent': 'OpenREL-App',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    let origin = FALLBACK_ORIGIN;
    try {
      origin = new URL(req.url).origin;
    } catch {
      // keep the fallback
    }
    const assetBase = String(body.asset_base_url || `${origin}/${DEMO_DIR}`).replace(/\/+$/, '');

    // 1. Demo assets
    const entries: { name: string; content: string }[] = [];
    for (const path of DEMO_ASSETS) {
      const res = await fetch(`${assetBase}/${path}?_=${Date.now()}`);
      if (!res.ok) {
        return Response.json(
          { error: `Could not read demo asset "${path}" (${res.status}) from ${assetBase}` },
          { status: 502 }
        );
      }
      entries.push({ name: path, content: await res.text() });
    }

    // 2. Endpoints and sources
    const [endpointRecords, sourceRecords] = await Promise.all([
      base44.asServiceRole.entities.ApiEndpoint.filter({ is_active: true }),
      base44.asServiceRole.entities.ApiSourceFile.filter({ is_active: true }),
    ]);

    const creds = await resolveGithubCredentials(base44, {});
    const { token, githubRepo, branch } = creds;

    async function listFolderFiles(folderPath: string): Promise<string[]> {
      const url = `https://api.github.com/repos/${githubRepo}/contents/${folderPath}?ref=${branch}&_=${Date.now()}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'OpenREL-App',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
      if (!res.ok) throw new Error(`GitHub ${res.status} listing ${folderPath}`);
      const listing = await res.json();
      if (!Array.isArray(listing)) return [];
      return listing
        .filter((item: any) => item.type === 'file' && String(item.name).endsWith('.ttl'))
        .map((item: any) => item.path);
    }

    const sections: Record<string, any> = {};
    const repoPaths = new Set<string>();
    const warnings: string[] = [];

    for (const sf of sourceRecords) {
      const mode = sf.source_mode || 'file';
      let files: string[] = [];

      if (mode === 'folder') {
        try {
          files = await listFolderFiles(sf.file_path);
          if (files.length === 0) warnings.push(`${sf.section}: no .ttl files found in ${sf.file_path}`);
        } catch (e: any) {
          warnings.push(`${sf.section}: ${e.message}`);
        }
      } else {
        files = String(sf.file_path || '')
          .split(/[\n,]+/)
          .map((p) => p.trim())
          .filter(Boolean);
      }

      // The Mappings section is composed from all other sources at request
      // time, so its generated cache file is not part of the bundle.
      if (sf.is_system && sf.section === 'Mappings') files = [];

      files.forEach((p) => repoPaths.add(p));

      sections[sf.section] = {
        section: sf.section,
        source_mode: mode,
        data_format: sf.data_format || 'ttl',
        member_identifier: sf.member_identifier || '',
        id_prefix: sf.id_prefix || '',
        title_field: sf.title_field || 'dct:title',
        description_field: sf.description_field || 'dct:description',
        is_system: !!sf.is_system,
        files: files.map((p) => ({ repo_path: p, local_path: `input/${p}` })),
      };
    }

    // 3. Source file contents
    const paths = [...repoPaths].slice(0, MAX_FILES);
    if (repoPaths.size > MAX_FILES) {
      warnings.push(`Only the first ${MAX_FILES} source files were bundled (${repoPaths.size} found).`);
    }

    const inputs: { name: string; content: string }[] = [];
    for (let i = 0; i < paths.length; i += FETCH_BATCH) {
      const batch = paths.slice(i, i + FETCH_BATCH);
      const results = await Promise.all(batch.map(async (p) => {
        const url = `https://api.github.com/repos/${githubRepo}/contents/${p}?ref=${branch}&_=${Date.now()}`;
        const res = await fetch(url, { headers: githubHeaders(token) });
        if (!res.ok) throw new Error(`GitHub ${res.status} for ${p}`);
        return { name: `input/${p}`, content: await res.text() };
      }).map((promise) => promise.catch((e) => {
        warnings.push(e.message);
        return null;
      })));
      results.forEach((r) => { if (r) inputs.push(r); });
    }

    // 4. Manifest
    const manifest = {
      generated_at: new Date().toISOString(),
      repo: githubRepo,
      branch,
      endpoints: endpointRecords
        .filter((e: any) => e.is_active !== false)
        .map((e: any) => ({
          section: e.section,
          method: (e.method || 'GET').toUpperCase(),
          path: e.path,
          tag: e.tag || 'default',
          endpoint_type: e.endpoint_type || 'list',
          summary: e.summary || '',
          description: e.description || '',
          parameters: e.parameters || [],
          target_logic_type: e.target_logic_type || 'fetchApiSourceContent',
          logic_config: e.logic_config || {},
          is_active: e.is_active !== false,
        })),
      sections,
    };

    entries.push({ name: 'manifest.json', content: JSON.stringify(manifest, null, 2) });
    entries.push(...inputs);

    // 5. ZIP
    const bytes = await buildZip(entries);
    const today = new Date().toISOString().slice(0, 10);

    return Response.json({
      filename: `openrel-api-standalone-${today}.zip`,
      size: bytes.length,
      file_count: entries.length,
      endpoint_count: manifest.endpoints.length,
      section_count: Object.keys(sections).length,
      warnings,
      base64: toBase64(bytes),
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});