import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveGithubCredentials } from '../../shared/resolveGithubCredentials.ts';
import {
  extractPolicyMetadata,
  CURATED_FIELDS,
  DERIVED_FIELDS,
} from '../../shared/extractPolicyMetadata.ts';

/**
 * IndexPolicies
 * -------------
 * Enriches the curated Policy Index (data/input/policy_index.json) with
 * auto-derived metadata — legal-code links, citation metadata, publication
 * info — extracted from the canonical policy TTL files in the Policies
 * source folder. Curated fields (label, description, type, status, tags,
 * is_composite, hasPolicy, simple) are ALWAYS preserved; only the three
 * auto-derived objects (legal_code, citation, publication) are written.
 *
 * Invokable two ways:
 *   - KB Manager UI (user context) — dry_run preview then apply.
 *   - apiProxy / scheduled automation (service role) — sync, optional
 *     policy_iris list (empty = all).
 *
 * Payload:
 *   { policy_iris?: string[], dry_run?: boolean, message?: string }
 *
 * dry_run=true  → returns a per-policy diff (no write).
 * dry_run=false → merges, writes the updated index back via submitPolicyPR
 *                 (branch + PR), and returns the PR url plus the diff.
 */

const INDEX_FILE = 'data/input/policy_index.json';

interface LeafDiff {
  field: string;
  before: unknown;
  after: unknown;
  status: 'added' | 'changed';
}

function flatten(obj: unknown, prefix: string, out: Record<string, unknown>) {
  if (obj === null || obj === undefined) {
    out[prefix] = null;
    return;
  }
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    out[prefix] = obj;
    return;
  }
  for (const k of Object.keys(obj as Record<string, unknown>)) {
    flatten((obj as Record<string, unknown>)[k], prefix ? prefix + '.' + k : k, out);
  }
}

function diffDerived(oldObj: unknown, newObj: unknown): LeafDiff[] {
  const oldFlat: Record<string, unknown> = {};
  const newFlat: Record<string, unknown> = {};
  flatten(oldObj ?? {}, '', oldFlat);
  flatten(newObj, '', newFlat);
  const isEmpty = (v: unknown) =>
    v === null || v === undefined || v === '' ||
    (Array.isArray(v) && v.length === 0);
  const diffs: LeafDiff[] = [];
  const keys = new Set([...Object.keys(oldFlat), ...Object.keys(newFlat)]);
  for (const k of [...keys].sort()) {
    const ov = oldFlat[k];
    const nv = newFlat[k];
    if (JSON.stringify(ov) === JSON.stringify(nv)) continue;
    // Skip noise: a null/empty leaf becoming null/empty is not a real change.
    if (isEmpty(ov) && isEmpty(nv)) continue;
    if (isEmpty(ov)) {
      diffs.push({ field: k, before: null, after: nv, status: 'added' });
    } else {
      diffs.push({ field: k, before: ov, after: nv, status: 'changed' });
    }
  }
  return diffs;
}

export default async function indexPolicies(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: dry_run is read-only (no gate). Applying (write) requires an admin
    // when a user is present; the service-role path (apiProxy / automation)
    // has no user and is trusted by the gateway.
    let user: { role?: string } | null = null;
    try { user = await base44.auth.me(); } catch { user = null; }
    const body = await req.json().catch(() => ({}));
    const dryRun = !!body.dry_run;
    const isAdmin = !!user && /admin/i.test(user.role || '');
    if (!dryRun && user && !isAdmin) {
      return Response.json({ error: 'Admin role required to apply indexing' }, { status: 403 });
    }
    const requestedIris: string[] = Array.isArray(body.policy_iris) ? body.policy_iris : [];
    const message = body.message || 'Re-index policy index metadata (legal-code, citation, publication)';

    // 1. Current curated index.
    const idxRes = await base44.asServiceRole.functions.invoke('getPolicyIndex', {});
    const index = (idxRes as any)?.data ?? idxRes;
    if (!index || index.error) {
      return Response.json({ error: index?.error || 'Failed to load policy index' }, { status: 500 });
    }
    const policies: any[] = Array.isArray(index.policies) ? index.policies : [];

    // 2. Resolve the Policies source folder path.
    const sourceFiles = await base44.asServiceRole.entities.ApiSourceFile.filter({ section: 'Policies' });
    const folderPath = sourceFiles[0]?.file_path || 'data/policy';

    // 3. Fetch GitHub creds + list the policy folder.
    const creds = await resolveGithubCredentials(base44, {});
    const token = creds.token;
    const repo = creds.githubRepo;
    const branch = creds.branch;
    if (!token || !repo) {
      return Response.json({ error: 'GitHub credentials not configured' }, { status: 500 });
    }
    const ghHeaders = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'OpenREL-App',
    };
    const listUrl = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(folderPath)}?ref=${branch}`;
    const listRes = await fetch(listUrl, { headers: ghHeaders });
    if (!listRes.ok) {
      return Response.json({ error: `Failed to list policy folder (${listRes.status})` }, { status: 500 });
    }
    const files = await listRes.json();
    const ttlFiles = Array.isArray(files) ? files.filter((f: any) => f.name?.endsWith('.ttl')) : [];

    // 4. Parse each TTL → metadata, keyed by subject_curie (e.g. openrel:CC0-1.0).
    const metadataByCurie = new Map<string, any>();
    const parseErrors: { file: string; error: string }[] = [];
    for (const f of ttlFiles) {
      try {
        const rawRes = await fetch(f.download_url, { headers: ghHeaders });
        if (!rawRes.ok) { parseErrors.push({ file: f.name, error: `fetch ${rawRes.status}` }); continue; }
        const ttlText = await rawRes.text();
        const md = extractPolicyMetadata(ttlText);
        if (md) metadataByCurie.set(md.subject_curie, md);
      } catch (e: any) {
        parseErrors.push({ file: f.name, error: e?.message || String(e) });
      }
    }

    // 5. Determine target index entries.
    const targets = requestedIris.length
      ? policies.filter((p) => requestedIris.includes(p.iri))
      : policies;
    const requestedSet = new Set(requestedIris);
    if (requestedIris.length) {
      for (const iri of requestedIris) {
        if (!policies.some((p) => p.iri === iri)) {
          targets.push({ iri, _missing: true });
        }
      }
    }

    // 6. Merge + diff per target (preserve curated fields).
    const changes: any[] = [];
    let changedCount = 0;
    let unchangedCount = 0;
    let notFoundCount = 0;
    const mergedPolicies: any[] = [...policies];

    for (const entry of targets) {
      if (entry._missing) {
        changes.push({ iri: entry.iri, label: '', status: 'not_in_index' });
        notFoundCount++;
        continue;
      }
      const md = metadataByCurie.get(entry.iri);
      if (!md) {
        changes.push({ iri: entry.iri, label: entry.label || '', status: 'no_ttl' });
        notFoundCount++;
        continue;
      }
      const newDerived = {
        legal_code: md.legal_code,
        citation: md.citation,
        publication: md.publication,
      };
      const oldDerived = {
        legal_code: entry.legal_code,
        citation: entry.citation,
        publication: entry.publication,
      };
      const added: LeafDiff[] = [];
      const changed: LeafDiff[] = [];
      for (const field of DERIVED_FIELDS) {
        const d = diffDerived((oldDerived as any)[field], (newDerived as any)[field]);
        for (const x of d) (x.status === 'added' ? added : changed).push({ field: `${field}.${x.field}`, ...x, status: x.status } as any);
      }
      const hasChanges = added.length + changed.length > 0;
      if (hasChanges) changedCount++; else unchangedCount++;
      changes.push({
        iri: entry.iri,
        label: entry.label || md.citation?.title || '',
        status: hasChanges ? 'changed' : 'unchanged',
        added,
        changed,
        curated_fields: CURATED_FIELDS.filter((k) => entry[k] !== undefined),
      });
      // Apply merge into the working copy.
      const idx = mergedPolicies.findIndex((p) => p.iri === entry.iri);
      if (idx >= 0) {
        mergedPolicies[idx] = { ...mergedPolicies[idx], ...newDerived };
      }
    }

    if (dryRun) {
      return Response.json({
        dry_run: true,
        total: targets.length,
        changed_count: changedCount,
        unchanged_count: unchangedCount,
        not_found_count: notFoundCount,
        parse_errors: parseErrors,
        changes,
      });
    }

    // 7. Apply: write updated index back via submitPolicyPR (branch + PR).
    const updatedIndex = {
      ...index,
      generated_at: new Date().toISOString(),
      policies: mergedPolicies,
    };
    const serialized = JSON.stringify(updatedIndex, null, 2);
    const prRes = await base44.asServiceRole.functions.invoke('submitPolicyPR', {
      file_path: INDEX_FILE,
      file_content: serialized,
      message,
    });
    const prData = (prRes as any)?.data ?? prRes;
    if (prData?.error) {
      return Response.json({ error: `submitPolicyPR failed: ${prData.error}` }, { status: 500 });
    }

    return Response.json({
      dry_run: false,
      total: targets.length,
      changed_count: changedCount,
      unchanged_count: unchangedCount,
      not_found_count: notFoundCount,
      parse_errors: parseErrors,
      changes,
      pr_url: prData?.pr_url || null,
      pr_number: prData?.pr_number || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}