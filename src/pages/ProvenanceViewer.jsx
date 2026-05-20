import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RETROACTIVE_ORCID } from '@/lib/provenance';
import { GitBranch, FileText, User, Calendar, RefreshCw, Tag, Layers } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from '@/components/ui/use-toast';

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDate(val) {
  if (!val) return null;
  try { return format(parseISO(val), 'dd MMM yyyy, HH:mm'); } catch { return val; }
}

function OrcidPill({ orcid }) {
  if (!orcid) return <span className="text-muted-foreground text-xs italic">unknown</span>;
  const isRetro = orcid === RETROACTIVE_ORCID;
  return (
    <a
      href={`https://orcid.org/${orcid}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-full border transition-colors hover:opacity-80 ${
        isRetro
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
          : 'border-primary/40 bg-primary/10 text-primary'
      }`}
    >
      <User className="w-3 h-3" />
      {orcid}
      {isRetro && <span className="text-amber-400 opacity-70">(retroactive)</span>}
    </a>
  );
}

function ProvenanceRow({ label, icon: Icon, children }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-1.5 min-w-[160px] text-xs text-muted-foreground pt-0.5">
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
        <span>{label}</span>
      </div>
      <div className="flex-1 text-sm text-foreground">{children}</div>
    </div>
  );
}

// ── Workflow Instance Card ────────────────────────────────────────────────────

const WORKFLOW_TYPE_LABELS = {
  licence: 'Licence Workflow',
  reuse:   'Reuse Workflow',
};

function WorkflowInstanceCard({ record }) {
  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <CardTitle className="text-base font-semibold text-foreground truncate">{record.name}</CardTitle>
          {record.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{record.description}</p>
          )}
        </div>
        <Badge variant="secondary" className="shrink-0 text-xs">
          {WORKFLOW_TYPE_LABELS[record.workflow_type] ?? record.workflow_type}
        </Badge>
      </CardHeader>
      <CardContent className="pt-0">
        <ProvenanceRow label="Record ID" icon={Tag}>
          <span className="font-mono text-xs text-muted-foreground">{record.id}</span>
        </ProvenanceRow>
        <ProvenanceRow label="Created by" icon={User}>
          <OrcidPill orcid={record.created_by_orcid} />
        </ProvenanceRow>
        <ProvenanceRow label="Last updated by" icon={User}>
          <OrcidPill orcid={record.updated_by_orcid} />
        </ProvenanceRow>
        <ProvenanceRow label="Account email" icon={User}>
          <span className="text-xs">{record.created_by || <span className="text-muted-foreground italic">unknown</span>}</span>
        </ProvenanceRow>
        <ProvenanceRow label="Created date" icon={Calendar}>
          <span className="text-xs">{formatDate(record.created_date) ?? <span className="text-muted-foreground italic">—</span>}</span>
        </ProvenanceRow>
        <ProvenanceRow label="Last modified" icon={RefreshCw}>
          <span className="text-xs">{formatDate(record.updated_date) ?? <span className="text-muted-foreground italic">—</span>}</span>
        </ProvenanceRow>
        <ProvenanceRow label="Last opened" icon={Calendar}>
          <span className="text-xs">{formatDate(record.last_opened_at) ?? <span className="text-muted-foreground italic">—</span>}</span>
        </ProvenanceRow>
        <ProvenanceRow label="Workflow type" icon={GitBranch}>
          <span className="text-xs">{WORKFLOW_TYPE_LABELS[record.workflow_type] ?? record.workflow_type}</span>
        </ProvenanceRow>
        <ProvenanceRow label="Steps completed" icon={Layers}>
          <span className="text-xs">
            {record.step_data ? Object.keys(record.step_data).length : 0} step(s) recorded
          </span>
        </ProvenanceRow>
      </CardContent>
    </Card>
  );
}

// ── Draft Policy Card (localStorage) ─────────────────────────────────────────

const ODRL_TYPE_LABELS = {
  'odrl:Set':       'ODRL Set',
  'odrl:Offer':     'ODRL Offer',
  'odrl:Agreement': 'ODRL Agreement',
};

function DraftPolicyCard({ policy }) {
  const rulesCount = [
    ...(policy.permission  ?? []),
    ...(policy.prohibition ?? []),
    ...(policy.duty        ?? []),
  ].length;

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <CardTitle className="text-base font-semibold text-foreground truncate">
            {policy.label ?? policy.id ?? 'Untitled Draft'}
          </CardTitle>
          {policy.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{policy.description}</p>
          )}
        </div>
        <Badge variant="outline" className="shrink-0 text-xs border-amber-500/40 text-amber-400">
          Draft
        </Badge>
      </CardHeader>
      <CardContent className="pt-0">
        <ProvenanceRow label="Policy ID" icon={Tag}>
          <span className="font-mono text-xs text-muted-foreground break-all">{policy.id ?? '—'}</span>
        </ProvenanceRow>
        <ProvenanceRow label="ODRL type" icon={FileText}>
          <span className="text-xs">{ODRL_TYPE_LABELS[policy['@type']] ?? policy['@type'] ?? '—'}</span>
        </ProvenanceRow>
        <ProvenanceRow label="Status" icon={Tag}>
          <span className="text-xs">{policy.status ?? '—'}</span>
        </ProvenanceRow>
        <ProvenanceRow label="Created by" icon={User}>
          <OrcidPill orcid={policy.created_by_orcid} />
        </ProvenanceRow>
        <ProvenanceRow label="Last updated by" icon={User}>
          <OrcidPill orcid={policy.updated_by_orcid} />
        </ProvenanceRow>
        <ProvenanceRow label="Derived from" icon={GitBranch}>
          {policy.derived_from
            ? <span className="font-mono text-xs text-muted-foreground break-all">{policy.derived_from}</span>
            : <span className="text-muted-foreground italic text-xs">original</span>
          }
        </ProvenanceRow>
        <ProvenanceRow label="Rules" icon={Layers}>
          <span className="text-xs">{rulesCount} rule(s) — {(policy.permission ?? []).length} permission, {(policy.prohibition ?? []).length} prohibition, {(policy.duty ?? []).length} duty</span>
        </ProvenanceRow>
        <ProvenanceRow label="Storage" icon={FileText}>
          <span className="text-xs text-muted-foreground italic">Local draft (browser storage)</span>
        </ProvenanceRow>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProvenanceViewer() {
  const [localDrafts, setLocalDrafts] = useState([]);

  // Load local drafts from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('kbcompose_drafts');
      setLocalDrafts(raw ? JSON.parse(raw) : []);
    } catch { setLocalDrafts([]); }
  }, []);

  const queryClient = useQueryClient();
  const [batching, setBatching] = useState(false);
  const [batchingDrafts, setBatchingDrafts] = useState(false);

  const { data: workflowInstances = [], isLoading: loadingWF } = useQuery({
    queryKey: ['provenance-workflow-instances'],
    queryFn: () => base44.entities.WorkflowInstance.list('-created_date', 200),
  });

  async function handleBatchUpdate() {
    setBatching(true);
    try {
      await Promise.all(
        workflowInstances.map(w =>
          base44.entities.WorkflowInstance.update(w.id, {
            created_by_orcid: RETROACTIVE_ORCID,
            updated_by_orcid: RETROACTIVE_ORCID,
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ['provenance-workflow-instances'] });
      toast({ title: 'Batch update complete', description: `${workflowInstances.length} record(s) updated to ${RETROACTIVE_ORCID}.` });
    } catch (e) {
      toast({ title: 'Batch update failed', description: e.message, variant: 'destructive' });
    } finally {
      setBatching(false);
    }
  }

  async function handleBatchUpdateDrafts() {
    setBatchingDrafts(true);
    try {
      const updated = localDrafts.map(p => ({
        ...p,
        created_by_orcid: RETROACTIVE_ORCID,
        updated_by_orcid: RETROACTIVE_ORCID,
      }));
      localStorage.setItem('kbcompose_drafts', JSON.stringify(updated));
      setLocalDrafts(updated);
      toast({ title: 'Batch update complete', description: `${updated.length} draft(s) updated to ${RETROACTIVE_ORCID}.` });
    } catch (e) {
      toast({ title: 'Batch update failed', description: e.message, variant: 'destructive' });
    } finally {
      setBatchingDrafts(false);
    }
  }

  const totalRecords = workflowInstances.length + localDrafts.length;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Provenance Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Origin, authorship and lineage of data records in this workspace.
          </p>
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1">
          {totalRecords} record{totalRecords !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="workflows">
        <TabsList className="mb-4">
          <TabsTrigger value="workflows">
            Workflow Instances
            <Badge variant="outline" className="ml-2 text-xs">{workflowInstances.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="drafts">
            Policies
            <Badge variant="outline" className="ml-2 text-xs">{localDrafts.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Workflow Instances */}
        <TabsContent value="workflows" className="space-y-4">
          {workflowInstances.length > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30">
              <span className="text-xs text-muted-foreground">
                Set <span className="font-semibold">Created By</span> and <span className="font-semibold">Last Updated By</span> to{' '}
                <span className="font-mono text-foreground">{RETROACTIVE_ORCID}</span> for all {workflowInstances.length} records.
              </span>
              <Button size="sm" variant="secondary" onClick={handleBatchUpdate} disabled={batching} className="ml-4 shrink-0">
                {batching ? <><RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />Updating…</> : 'Batch Update All'}
              </Button>
            </div>
          )}
          {loadingWF ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading records…
            </div>
          ) : workflowInstances.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No workflow instances found.</div>
          ) : (
            workflowInstances.map(record => (
              <WorkflowInstanceCard key={record.id} record={record} />
            ))
          )}
        </TabsContent>

        {/* Draft Policies */}
        <TabsContent value="drafts" className="space-y-4">
          {localDrafts.length > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30">
              <span className="text-xs text-muted-foreground">
                Set <span className="font-semibold">Created By</span> and <span className="font-semibold">Last Updated By</span> to{' '}
                <span className="font-mono text-foreground">{RETROACTIVE_ORCID}</span> for all {localDrafts.length} drafts.
              </span>
              <Button size="sm" variant="secondary" onClick={handleBatchUpdateDrafts} disabled={batchingDrafts} className="ml-4 shrink-0">
                {batchingDrafts ? <><RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />Updating…</> : 'Batch Update All'}
              </Button>
            </div>
          )}
          {localDrafts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No local draft policies found. Create a draft in KB Compose or via a Workflow.
            </div>
          ) : (
            localDrafts.map((policy, i) => (
              <DraftPolicyCard key={policy.id ?? i} policy={policy} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}