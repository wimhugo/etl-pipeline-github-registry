import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Play, GitPullRequest, Loader2, DatabaseZap } from 'lucide-react';
import IndexScopeSelector from '@/components/indexing/IndexScopeSelector';
import IndexDiffPreview from '@/components/indexing/IndexDiffPreview';

/**
 * IndexingUtility — KB Manager page that re-indexes the curated Policy Index
 * with auto-derived metadata (legal-code links, citation, publication) pulled
 * from the canonical policy TTLs. Curated fields are preserved; only the
 * three auto-derived objects are written. One-click batch run → diff preview
 * → apply (creates a PR via submitPolicyPR).
 */
export default function IndexingUtility() {
  const { toast } = useToast();
  const [policies, setPolicies] = useState([]);
  const [loadingIndex, setLoadingIndex] = useState(true);
  const [scope, setScope] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [prUrl, setPrUrl] = useState(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await base44.functions.invoke('getPolicyIndex', {});
        const idx = res?.data ?? res;
        if (alive && idx && Array.isArray(idx.policies)) {
          setPolicies(idx.policies);
        }
      } catch (e) {
        if (alive) toast({ title: 'Could not load current index', description: e.message, variant: 'destructive' });
      } finally {
        if (alive) setLoadingIndex(false);
      }
    })();
    return () => { alive = false; };
  }, [toast]);

  const selectedIris = scope === 'all' ? [] : [...selected];

  const runIndexing = async () => {
    setRunning(true);
    setResult(null);
    setPrUrl(null);
    try {
      const res = await base44.functions.invoke('indexPolicies', {
        policy_iris: selectedIris,
        dry_run: true,
      });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      setResult({ ...data, index_version: policies.length ? 'curated' : '—' });
    } catch (e) {
      toast({ title: 'Indexing preview failed', description: e.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  const applyIndexing = async () => {
    setApplying(true);
    try {
      const res = await base44.functions.invoke('indexPolicies', {
        policy_iris: selectedIris,
        dry_run: false,
      });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      setResult({ ...data, index_version: policies.length ? 'curated' : '—' });
      if (data.pr_url) {
        setPrUrl(data.pr_url);
        toast({ title: 'Pull request created', description: 'Index update submitted for review.', duration: 30000 });
      }
    } catch (e) {
      toast({ title: 'Apply failed', description: e.message, variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2.5">
          <DatabaseZap className="w-6 h-6 text-primary" />
          Indexing Utility
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
          Re-index the curated Policy Index with auto-derived metadata — legal-code links, citation metadata,
          and publication info — extracted from the canonical policy TTL files. Human-curated fields are preserved;
          only the auto-derived objects are written back via a pull request.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card/50 p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-1">Scope</h2>
          <p className="text-xs text-muted-foreground mb-3">Choose which policies to re-index.</p>
          {loadingIndex ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading current index…
            </div>
          ) : (
            <IndexScopeSelector
              policies={policies}
              scope={scope}
              setScope={setScope}
              selected={selected}
              setSelected={setSelected}
            />
          )}
        </div>

        <div className="flex items-center gap-2.5 pt-1">
          <Button onClick={runIndexing} disabled={running || applying || loadingIndex || (scope === 'selected' && selected.size === 0)}>
            {running ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            Run indexing
          </Button>
          {result && result.changed_count > 0 && !prUrl && (
            <Button variant="default" onClick={applyIndexing} disabled={applying}>
              {applying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <GitPullRequest className="w-4 h-4 mr-2" />}
              Apply &amp; create PR
            </Button>
          )}
          {prUrl && (
            <a href={prUrl} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
              <GitPullRequest className="w-4 h-4" /> View pull request ↗
            </a>
          )}
        </div>
      </section>

      {result && (
        <section className="rounded-xl border border-border bg-card/50 p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            {result.dry_run ? 'Diff preview' : 'Applied changes'}
          </h2>
          <IndexDiffPreview result={result} />
        </section>
      )}
    </div>
  );
}