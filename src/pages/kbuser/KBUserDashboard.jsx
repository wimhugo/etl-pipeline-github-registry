import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import KBEntityCard from '@/components/kbuser/KBEntityCard';
import { Link } from 'react-router-dom';
import { FileJson, ShieldCheck, Zap, Lock, BookOpen, Users, Layers, Workflow, FileCheck2, Search, Microscope, ArrowRight, BookMarked, Shuffle } from 'lucide-react';
import IWantToSection from '@/components/kbuser/IWantToSection';

const SUB_ENTITY_HINTS = ['actions', 'constraints', 'agents', 'sources', 'scenarios'];

const ENTITY_META = {
  policies:    { label: 'Policies',    icon: ShieldCheck, color: 'text-primary',     bg: 'bg-primary/10',     border: 'border-primary/25',    countKey: null },
  actions:     { label: 'Actions',     icon: Zap,         color: 'text-yellow-400',  bg: 'bg-yellow-400/10',  border: 'border-yellow-400/25', countKey: 'actions' },
  constraints: { label: 'Constraints', icon: Lock,        color: 'text-orange-400',  bg: 'bg-orange-400/10',  border: 'border-orange-400/25', countKey: 'constraints' },
  agents:      { label: 'Agents',      icon: Users,       color: 'text-purple-400',  bg: 'bg-purple-400/10',  border: 'border-purple-400/25', countKey: 'agents' },
  sources:     { label: 'Sources',     icon: BookOpen,    color: 'text-accent',      bg: 'bg-accent/10',      border: 'border-accent/25',     countKey: 'sources' },
  scenarios:   { label: 'Scenarios',   icon: Layers,      color: 'text-blue-400',    bg: 'bg-blue-400/10',    border: 'border-blue-400/25',   countKey: 'scenarioGroups' },
};

function deriveCount(data, hint) {
  if (!data) return null;
  if (Array.isArray(data)) return data.length;
  // Try common top-level array keys
  const candidates = [hint, ENTITY_META[hint]?.countKey, 'items', 'data'].filter(Boolean);
  for (const key of candidates) {
    if (Array.isArray(data[key])) {
      // For scenarios, count individual scenarios inside groups
      if (hint === 'scenarios') {
        return data[key].reduce((sum, g) => sum + (g.scenarios?.length || 0), 0);
      }
      return data[key].length;
    }
  }
  // Last resort: first array value
  const firstArr = Object.values(data).find(v => Array.isArray(v));
  return firstArr ? firstArr.length : null;
}

function deriveExtra(data, hint) {
  if (!data) return [];
  const extras = [];
  if (hint === 'policies') {
    const arr = Array.isArray(data) ? data : data.policies || [];
    const types = [...new Set(arr.map(p => p.odrl_type).filter(Boolean))];
    if (types.length) extras.push({ label: 'Types', value: types.length });
    const assigners = [...new Set(arr.map(p => p.assigner).filter(Boolean))];
    if (assigners.length) extras.push({ label: 'Assigners', value: assigners.length });
  }
  if (hint === 'constraints') {
    const arr = Array.isArray(data) ? data : data.constraints || [];
    const ops = [...new Set(arr.map(c => c.operator).filter(Boolean))];
    if (ops.length) extras.push({ label: 'Operators', value: ops.length });
  }
  if (hint === 'actions') {
    const arr = Array.isArray(data) ? data : data.actions || [];
    const cats = [...new Set(arr.map(a => a.category).filter(Boolean))];
    if (cats.length) extras.push({ label: 'Categories', value: cats.length });
  }
  if (hint === 'scenarios') {
    const arr = Array.isArray(data) ? data : data.scenarioGroups || [];
    extras.push({ label: 'Groups', value: arr.length });
  }
  return extras;
}

function useKBFile(rawBaseUrl, filename) {
  return useQuery({
    queryKey: ['kbDashFile', rawBaseUrl, filename],
    queryFn: async () => {
      const r = await fetch(`${rawBaseUrl}/${filename}`);
      if (!r.ok) throw new Error(`Failed: ${filename}`);
      return r.json();
    },
    enabled: !!rawBaseUrl && !!filename,
    staleTime: 5 * 60 * 1000,
  });
}

export default function KBUserDashboard() {
  const { data: globalConfigs = [] } = useQuery({
    queryKey: ['globalConfig'],
    queryFn: () => base44.entities.GlobalConfig.list(),
  });
  const config = globalConfigs[0] || {};
  const rawBaseUrl = config.kb_search_data_url || '';
  const apiUrl = (config.kb_search_data_api_url || '').replace(/\?ref=[^&]*/, '');

  const { data: fileList = [] } = useQuery({
    queryKey: ['kbDashFiles', apiUrl],
    queryFn: async () => { const r = await fetch(apiUrl); if (!r.ok) throw new Error(); return r.json(); },
    enabled: !!apiUrl,
    staleTime: 5 * 60 * 1000,
  });

  const jsonFiles = fileList.filter(f => f.name?.toLowerCase().endsWith('.json'));

  // Resolve filenames
  const subFiles = config.kb_sub_entity_files || {};
  const autoFile = (hint) => jsonFiles.find(f => f.name.toLowerCase().includes(hint))?.name || '';

  const policyFile  = config.kb_policy_file || autoFile('polic');
  const fileMap = {};
  for (const hint of SUB_ENTITY_HINTS) {
    fileMap[hint] = subFiles[hint] || autoFile(hint);
  }

  // Fetch all files
  const policyQ      = useKBFile(rawBaseUrl, policyFile);
  const actionsQ     = useKBFile(rawBaseUrl, fileMap.actions);
  const constraintsQ = useKBFile(rawBaseUrl, fileMap.constraints);
  const agentsQ      = useKBFile(rawBaseUrl, fileMap.agents);
  const sourcesQ     = useKBFile(rawBaseUrl, fileMap.sources);
  const scenariosQ   = useKBFile(rawBaseUrl, fileMap.scenarios);

  const cards = [
    { hint: 'policies',    query: policyQ,      file: policyFile },
    { hint: 'actions',     query: actionsQ,     file: fileMap.actions },
    { hint: 'constraints', query: constraintsQ, file: fileMap.constraints },
    { hint: 'agents',      query: agentsQ,      file: fileMap.agents },
    { hint: 'sources',     query: sourcesQ,     file: fileMap.sources },
    { hint: 'scenarios',   query: scenariosQ,   file: fileMap.scenarios },
  ];

  // Find GitHub file metadata for last-updated
  const fileMeta = {};
  for (const f of jsonFiles) fileMeta[f.name] = f;

  const notConfigured = !rawBaseUrl && globalConfigs.length > 0;

  // My Workflows summary
  const { data: workflowInstances = [] } = useQuery({
    queryKey: ['workflowInstances'],
    queryFn: () => base44.entities.WorkflowInstance.list(),
  });
  const { data: objectAnalyses = [] } = useQuery({
    queryKey: ['objectAnalyses'],
    queryFn: () => base44.entities.ObjectAnalysis.list(),
  });

  const wfCounts = {
    licence: workflowInstances.filter(w => w.workflow_type === 'licence').length,
    reuse: workflowInstances.filter(w => w.workflow_type === 'reuse').length,
    policy_analysis: objectAnalyses.length,
  };
  const totalWorkflows = workflowInstances.length + objectAnalyses.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">KB Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of the configured knowledge base data files.
        </p>
      </div>

      <IWantToSection />

      {/* My Workflows summary card */}
      <Link to="/kb-user/workflow" className="block">
        <div className="rounded-xl border border-border/50 bg-card p-5 hover:border-primary/30 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Workflow className="w-4 h-4 text-primary" />
              </div>
              <span className="font-semibold text-sm">My Workflows</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-bold">{totalWorkflows}</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BookMarked className="w-3.5 h-3.5 text-primary" />
              <span>{wfCounts.licence} Licence</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Shuffle className="w-3.5 h-3.5 text-accent" />
              <span>{wfCounts.reuse} Reuse</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Microscope className="w-3.5 h-3.5 text-chart-3" />
              <span>{wfCounts.policy_analysis} Analysis</span>
            </div>
          </div>
        </div>
      </Link>

      {notConfigured && (
        <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
          No KB data source configured. Go to <strong>Configuration</strong> to set up your data repository.
        </div>
      )}

      {rawBaseUrl && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(({ hint, query, file }) => (
            <KBEntityCard
              key={hint}
              hint={hint}
              meta={ENTITY_META[hint]}
              data={query.data}
              isLoading={query.isLoading}
              isError={query.isError}
              filename={file}
              fileMeta={fileMeta[file]}
              count={deriveCount(query.data, hint)}
              extras={deriveExtra(query.data, hint)}
            />
          ))}
        </div>
      )}
    </div>
  );
}