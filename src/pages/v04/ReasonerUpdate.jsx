import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Play, GitPullRequest, Loader2, Network, Sparkles } from 'lucide-react';

/**
 * ReasonerUpdate (v0.4) — builds the OpenREL Reasoner Graph
 * (data/reasoner/graph_reasoner.ttl): a reified, editable graph of assertions
 * between actions using the type_evaluation relations (includedIn /
 * contradicts / implies). Deterministic edges are derived from actions.ttl
 * (odrl:includedIn, skos mappings, defaultDuty, authored contradicts);
 * probabilistic edges are LLM drafts for human review. Probabilistic edges
 * are dropped where a deterministic edge already exists. Human-authored
 * deterministic (source "manual") and reviewed probabilistic assertions are
 * preserved across re-runs. Output is committed via a pull request.
 */
export default function ReasonerUpdate() {
  const { toast } = useToast();
  const [skipLlm, setSkipLlm] = useState(false);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [prUrl, setPrUrl] = useState(null);

  const runPreview = async () => {
    setRunning(true);
    setResult(null);
    setPrUrl(null);
    try {
      const res = await base44.functions.invoke('reasonerUpdate', { dry_run: true, skip_llm: skipLlm });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      toast({ title: 'Preview failed', description: e.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  const applyUpdate = async () => {
    setApplying(true);
    try {
      const res = await base44.functions.invoke('reasonerUpdate', { dry_run: false, skip_llm: skipLlm });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      if (data.pr_url) {
        setPrUrl(data.pr_url);
        toast({ title: 'Pull request created', description: 'Reasoner graph update submitted for review.', duration: 30000 });
      }
    } catch (e) {
      toast({ title: 'Apply failed', description: e.message, variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  const relLabel = (iri) => iri.replace('openrel:', '').replace('odrl:', '');

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2.5">
          <Network className="w-6 h-6 text-primary" />
          Reasoner Update
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
          Build the OpenREL Reasoner Graph (<code className="text-xs">data/reasoner/graph_reasoner.ttl</code>) — a
          reified, editable graph of assertions between actions using the type_evaluation relations
          (<code className="text-xs">includedIn</code>, <code className="text-xs">contradicts</code>,{' '}
          <code className="text-xs">implies</code>). Deterministic edges are derived from actions.ttl
          (<code className="text-xs">odrl:includedIn</code>, skos mappings, <code className="text-xs">defaultDuty</code>,
          authored contradicts); probabilistic edges are LLM drafts for review. Probabilistic edges are dropped where a
          deterministic edge already exists. Human-authored deterministic and reviewed probabilistic assertions are
          preserved across re-runs.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card/50 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <input
            id="skipLlm"
            type="checkbox"
            checked={skipLlm}
            onChange={(e) => setSkipLlm(e.target.checked)}
            className="w-4 h-4 rounded border-border accent-primary"
          />
          <Label htmlFor="skipLlm" className="text-sm font-normal cursor-pointer">
            Deterministic-only (skip LLM probabilistic pass)
          </Label>
        </div>

        <div className="flex items-center gap-2.5">
          <Button onClick={runPreview} disabled={running || applying}>
            {running ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            Generate preview
          </Button>
          {result && !prUrl && (
            <Button onClick={applyUpdate} disabled={applying}>
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
        <section className="rounded-xl border border-border bg-card/50 p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Actions parsed" value={result.actions_parsed} />
            <Stat label="Deterministic" value={result.deterministic_count}
                  sub={`${result.deterministic_new} new · ${result.deterministic_preserved_manual} preserved`} />
            <Stat label="Probabilistic" value={result.probabilistic_count}
                  sub={`${result.probabilistic_new} new · ${result.probabilistic_preserved} preserved`} />
            <Stat label="Dropped (shadowed)" value={result.probabilistic_dropped_shadowed} />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Assertion preview ({result.total})
            </h2>
            <div className="rounded-lg border border-border bg-background/40 max-h-[460px] overflow-y-auto divide-y divide-border">
              {(result.sample || []).map((a, i) => (
                <div key={i} className="px-3 py-2 flex items-start gap-3 text-xs">
                  <span className={`font-mono px-1.5 py-0.5 rounded shrink-0 ${
                    a.derivation === 'Deterministic'
                      ? 'bg-accent/15 text-accent'
                      : 'bg-primary/15 text-primary'
                  }`}>
                    {a.derivation === 'Deterministic' ? 'DET' : 'PROB'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono">
                      <span className="text-foreground">{a.subject}</span>{' '}
                      <span className="text-muted-foreground">{relLabel(a.relation)}</span>{' '}
                      <span className="text-foreground">{a.object}</span>
                      {a.role && <span className="text-muted-foreground"> · {relLabel(a.role)}</span>}
                    </div>
                    {a.rationale && <div className="text-muted-foreground mt-0.5">{a.rationale}</div>}
                    <div className="text-muted-foreground/70 mt-0.5">
                      {a.source}{a.confidence != null ? ` · conf ${a.confidence.toFixed(2)}` : ''}
                    </div>
                  </div>
                </div>
              ))}
              {result.total > (result.sample || []).length && (
                <div className="px-3 py-2 text-xs text-muted-foreground italic">
                  … {result.total - (result.sample || []).length} more in the generated graph
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold text-foreground">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground/70">{sub}</div>}
    </div>
  );
}