import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveGithubCredentials } from '../../shared/resolveGithubCredentials.ts';
import {
  extractPolicyMetadata,
  compactForIndex,
  CURATED_FIELDS,
  DERIVED_FIELDS,
} from '../../shared/extractPolicyMetadata.ts';
import { submitGithubPR } from '../../shared/submitGithubPR.ts';

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

    // 4.5. Parameter concept scheme (parameters.ttl) via the API — map each
    // parameter IRI to its prefLabel so the index stores human-readable labels
    // instead of IRIs. Keyed by both the member's full IRI and its openrel:
    // CURIE form so policy right-operand refs resolve regardless of form.
    const paramPrefLabel = new Map<string, string>();
    try {
      const pRes = await base44.asServiceRole.functions.invoke('fetchApiSourceContent', { section: 'Parameters' });
      const pData = (pRes as any)?.data ?? pRes;
      for (const m of pData?.members || []) {
        if (!m.iri || !m.label) continue;
        paramPrefLabel.set(m.iri, m.label);
        const c = compactForIndex(m.iri);
        if (c !== m.iri) paramPrefLabel.set(c, m.label);
      }
    } catch (e: any) {
      // Non-fatal: the parameters field just stays empty if the scheme can't load.
      console.warn('indexPolicies: could not load parameters scheme:', e?.message || e);
    }

    // 4.6. Constraints concept scheme (constraints.ttl) via the API — map each
    // shared named constraint IRI to its human-readable label.
    const sharedConstraintLabel = new Map<string, string>();
    try {
      const cRes = await base44.asServiceRole.functions.invoke('fetchApiSourceContent', { section: 'Constraints' });
      const cData = (cRes as any)?.data ?? cRes;
      for (const m of cData?.members || []) {
        if (!m.iri || !m.label) continue;
        sharedConstraintLabel.set(m.iri, m.label);
        const c = compactForIndex(m.iri);
        if (c !== m.iri) sharedConstraintLabel.set(c, m.label);
      }
    } catch (e: any) {
      console.warn('indexPolicies: could not load constraints scheme:', e?.message || e);
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
      const paramLabels = [...new Set(
        (md.parameter_iris || [])
          .map((pi: string) => paramPrefLabel.get(pi) || paramPrefLabel.get(compactForIndex(pi)))
          .filter(Boolean) as string[]
      )].sort();
      const constraintLabels = [...new Set(
        (md.constraint_iris || [])
          .map((ci: string) => {
            const c = compactForIndex(ci);
            return md.local_constraint_labels?.[c] || sharedConstraintLabel.get(c);
          })
          .filter(Boolean) as string[]
      )].sort();
      const newDerived = {
        legal_code: md.legal_code,
        citation: md.citation,
        publication: md.publication,
        parameters: paramLabels,
        constraints: constraintLabels,
      };
      const oldDerived = {
        legal_code: entry.legal_code,
        citation: entry.citation,
        publication: entry.publication,
        parameters: entry.parameters,
        constraints: entry.constraints,
      };
      const added: LeafDiff[] = [];
      const changed: LeafDiff[] = [];
      for (const field of DERIVED_FIELDS) {
        const d = diffDerived((oldDerived as any)[field], (newDerived as any)[field]);
        for (const x of d) (x.status === 'added' ? added : changed).push({ field: `${field}.${x.field}`, ...x, status: x.status } as any);
      }
      // parameters is a flat prefLabel array (not a nested object): diff whole-array.
      {
        const oldP = oldDerived.parameters || [];
        const newP = newDerived.parameters;
        if (JSON.stringify(oldP) !== JSON.stringify(newP)) {
          const wasEmpty = !oldP || (Array.isArray(oldP) && oldP.length === 0);
          (wasEmpty ? added : changed).push({
            field: 'parameters',
            before: wasEmpty ? null : oldP,
            after: newP,
            status: wasEmpty ? 'added' : 'changed',
          });
        }
      }
      // constraints is a flat named-constraint label array: diff whole-array.
      {
        const oldC = oldDerived.constraints || [];
        const newC = newDerived.constraints;
        if (JSON.stringify(oldC) !== JSON.stringify(newC)) {
          const wasEmpty = !oldC || (Array.isArray(oldC) && oldC.length === 0);
          (wasEmpty ? added : changed).push({
            field: 'constraints',
            before: wasEmpty ? null : oldC,
            after: newC,
            status: wasEmpty ? 'added' : 'changed',
          });
        }
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

    // 7. Apply: write updated index back directly via the shared GitHub PR
    //    helper (branch + commit + PR). We use the creds already resolved
    //    above rather than a function-to-function service-role invoke, which
    //    is unreliable for the write path.
    const updatedIndex = {
      ...index,
      generated_at: new Date().toISOString(),
      policies: mergedPolicies,
    };
    const serialized = JSON.stringify(updatedIndex, null, 2);

    let prResult: { pr_url: string; pr_number: number; branch: string };
    try {
      prResult = await submitGithubPR({
        token,
        repo,
        branch,
        filePath: INDEX_FILE,
        content: serialized,
        message,
        prTitle: 'Re-index policy index metadata',
        branchPrefix: 'reindex-policy-index',
      });
    } catch (e: any) {
      return Response.json({ error: `submitGithubPR failed: ${e?.message || String(e)}` }, { status: 500 });
    }

    return Response.json({
      dry_run: false,
      total: targets.length,
      changed_count: changedCount,
      unchanged_count: unchangedCount,
      not_found_count: notFoundCount,
      parse_errors: parseErrors,
      changes,
      pr_url: prResult.pr_url,
      pr_number: prResult.pr_number,
      branch: prResult.branch,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}