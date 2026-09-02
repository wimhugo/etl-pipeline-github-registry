import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import ReasonerSourceSteps from '@/components/reasoner/ReasonerSourceSteps';
import ReasonerAssertionPreview from '@/components/reasoner/ReasonerAssertionPreview';
import { Play, GitPullRequest, Loader2, Network, AlertTriangle } from 'lucide-react';

const CONFIG_KEY = 'openrel_reasoner_config_v2';
const CORPUS_BATCH = 10;
const DEFAULT_CONFIG = {
  actions_path: '',
  dg_enabled: true,
  dg_repo: 'dalicc/dalicc',
  dg_branch: 'main',
  dg_path: 'licensedata/dependencygraph/dg_default.ttl',
  corpus_enabled: true,
  corpus_repo: 'dalicc/dalicc',
  corpus_branch: 'main',
  corpus_folder: 'licensedata/licenses',
  corpus_min_support: 2,
  llm_enabled: true,
  model: 'gemini_3_flash',
};

function loadConfig() {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    return stored ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : { ...DEFAULT_CONFIG };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export default function ReasonerUpdate() {
  const { toast } = useToast();
  const [config, setConfig] = useState(loadConfig);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [prUrl, setPrUrl] = useState(null);
  const [assertions, setAssertions] = useState([]);
  const [corpusProgress, setCorpusProgress] = useState(null);
  const corpusEvidenceRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); } catch { /* ignore */ }
  }, [config]);

  const patchConfig = (patch) => setConfig((prev) => ({ ...prev, ...patch }));

  const buildPayload = (dryRun) => ({
    dry_run: dryRun,
    skip_llm: !config.llm_enabled,
    model: config.model,
    sources: {
      actions_path: config.actions_path || undefined,
      dg_enabled: config.dg_enabled,
      dg_repo: config.dg_repo,
      dg_branch: config.dg_branch,
      dg_path: config.dg_path,
      corpus_enabled: config.corpus_enabled,
      corpus_repo: config.corpus_repo,
      corpus_branch: config.corpus_branch,
      corpus_folder: config.corpus_folder,
      corpus_min_support: Number(config.corpus_min_support) || 2,
    },
  });

  // Fetch the licence corpus in backend batches, accumulating pair evidence
  // locally while reporting live progress (fetched/total) to the UI. Each
  // batch invocation is timeout-bounded: a stuck batch is skipped (counted
  // as errors) instead of hanging the whole run.
  const fetchCorpusEvidence = async () => {
    const evidence = { licences: 0, pd: {}, pp: {} };
    let start = 0;
    let total = null;
    let fetchErrors = 0;

    const invokeBatch = (offset) =>
      Promise.race([
        base44.functions.invoke('reasonerUpdate', {
          mode: 'corpus_fetch',
          sources: { ...buildPayload(true).sources, corpus_start: offset, corpus_count: CORPUS_BATCH },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('DALICC licence batch timed out')), 90000),
        ),
      ]);

    while (total === null || start < total) {
      let data;
      try {
        const res = await invokeBatch(start);
        data = res?.data ?? res;
        if (data?.error) throw new Error(data.error);
      } catch (e) {
        if (total === null) throw e; // cannot continue without the first batch
        fetchErrors += CORPUS_BATCH;
        start += CORPUS_BATCH;
        setCorpusProgress({ fetched: Math.min(start, total), total, errors: fetchErrors });
        continue;
      }
      total = data.total || 0;
      fetchErrors += data.errors || 0;
      for (const lic of data.licences || []) {
        evidence.licences++;
        for (const [s, o] of lic.pd || []) {
          const k = `${s}|${o}`;
          evidence.pd[k] = (evidence.pd[k] || 0) + 1;
        }
        for (const [s, o] of lic.pp || []) {
          const k = `${s}|${o}`;
          evidence.pp[k] = (evidence.pp[k] || 0) + 1;
        }
      }
      start += data.fetched || 0;
      setCorpusProgress({ fetched: start, total, errors: fetchErrors });
    }
    return evidence;
  };

  const runPreview = async () => {
    setRunning(true);
    setResult(null);
    setPrUrl(null);
    setCorpusProgress(null);
    try {
      let corpusEvidence;
      if (config.corpus_enabled) {
        try {
          corpusEvidence = await fetchCorpusEvidence();
        } catch (e) {
          // Degrade gracefully: continue without corpus evidence.
          corpusEvidence = { licences: 0, pd: {}, pp: {} };
          toast({ title: 'Licence corpus unavailable', description: e.message, duration: 30000 });
        }
      }
      corpusEvidenceRef.current = corpusEvidence || null;
      const res = await base44.functions.invoke('reasonerUpdate', {
        ...buildPayload(true),
        corpus_evidence: corpusEvidence || undefined,
      });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      setAssertions(data.assertions || []);
    } catch (e) {
      toast({ title: 'Preview failed', description: e.message, variant: 'destructive', duration: 30000 });
    } finally {
      setRunning(false);
      setCorpusProgress(null);
    }
  };

  const applyUpdate = async () => {
    setApplying(true);
    try {
      const res = await base44.functions.invoke('reasonerUpdate', {
        ...buildPayload(false),
        corpus_evidence: corpusEvidenceRef.current || undefined,
        curated_assertions: assertions,
      });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      if (data.pr_url) {
        setPrUrl(data.pr_url);
        toast({
          title: 'Pull request created',
          description: data.vocabulary_updated
            ? 'Reasoner graph update and openrel:allows vocabulary definition submitted for review.'
            : 'Reasoner graph update submitted for review.',
          duration: 30000,
        });
      }
    } catch (e) {
      toast({ title: 'Apply failed', description: e.message, variant: 'destructive', duration: 30000 });
    } finally {
      setApplying(false);
    }
  };

  const dg = result?.dg_summary;
  const corpus = result?.corpus_summary;
  const progressPct = corpusProgress && corpusProgress.total > 0
    ? (corpusProgress.fetched / corpusProgress.total) * 100
    : 0;

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
          <code className="text-xs">implies</code>, <code className="text-xs">allows</code>). Assertions are
          derived in three tiers — deterministic (actions.ttl + the DALICC dependency graph), corpus
          (statistical evidence from the DALICC licence corpus), and probabilistic (LLM drafts) — merged
          under the shadow rule Deterministic &gt; Corpus &gt; Probabilistic. Human-authored and curated
          assertions are preserved across re-runs.
        </p>
      </div>

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">Run steps &amp; sources</h2>
        <ReasonerSourceSteps config={config} onChange={patchConfig} disabled={running || applying} />
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex items-center gap-2.5">
            <Button onClick={runPreview} disabled={running || applying}>
              {running ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
              Generate preview
            </Button>
            {result && !prUrl && (
              <Button onClick={applyUpdate} disabled={running || applying}>
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
          {corpusProgress && (
            <div className="w-full max-w-sm space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Fetching DALICC licences…</span>
                <span className="font-mono">
                  {corpusProgress.fetched}/{corpusProgress.total}
                  {corpusProgress.errors > 0 && ` · ${corpusProgress.errors} errors`}
                </span>
              </div>
              <Progress value={progressPct} />
            </div>
          )}
        </div>
      </section>

      {result && (
        <section className="rounded-xl border border-border bg-card/50 p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Stat label="Actions parsed" value={result.actions_parsed} />
            <Stat label="Deterministic" value={result.deterministic_count}
                  sub={`${result.deterministic_new} new · ${result.deterministic_preserved_manual} preserved`} />
            <Stat label="Corpus" value={result.corpus_count}
                  sub={`${result.corpus_new} new · ${result.corpus_preserved_manual} preserved`} />
            <Stat label="Probabilistic" value={result.probabilistic_count}
                  sub={`${result.probabilistic_new} new · ${result.probabilistic_preserved} preserved`} />
            <Stat label="Dropped (shadowed)" value={result.probabilistic_dropped_shadowed} />
            <Stat label="Total" value={result.total ?? assertions.length} />
          </div>

          {(dg || corpus) && (
            <div className="grid gap-2 sm:grid-cols-2 text-xs">
              {dg && (
                <div className="rounded-lg border border-border bg-background/40 px-3 py-2 text-muted-foreground">
                  <span className="text-foreground font-medium">Dependency graph</span>
                  {!dg.enabled && ' — disabled'}
                  {dg.enabled && ` — ${dg.edges} edges · ${dg.same_as} sameAs pairs · ${dg.unresolved} unresolved targets`}
                  {dg.enabled && dg.error && <span className="text-destructive"> · error: {dg.error}</span>}
                </div>
              )}
              {corpus && (
                <div className="rounded-lg border border-border bg-background/40 px-3 py-2 text-muted-foreground">
                  <span className="text-foreground font-medium">Licence corpus</span>
                  {` — ${corpus.licences_parsed}/${corpus.licences_fetched} licences parsed · ${corpus.implies_candidates} duty pairs · ${corpus.allows_candidates} co-existence pairs (min support ${corpus.min_support})`}
                  {corpus.error && <span className="text-destructive"> · error: {corpus.error}</span>}
                </div>
              )}
            </div>
          )}

          {result.warnings?.length > 0 && (
            <div className="space-y-1">
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-400/90">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold text-foreground mb-2">Assertion preview — grouped by relation ({assertions.length})</h2>
            <ReasonerAssertionPreview assertions={assertions} onChange={setAssertions} />
            <p className="text-[11px] text-muted-foreground/70 mt-2">
              Duplicates are detected and dropped before preview; the list is alphabetical within each
              relation group. Use the icons to reverse a misdirected edge or delete an assertion — your
              curated set is committed on Apply.
            </p>
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