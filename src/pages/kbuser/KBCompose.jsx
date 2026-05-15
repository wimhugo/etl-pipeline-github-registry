import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import ComposePolicyCard from '@/components/kbcompose/ComposePolicyCard';
import PolicyFilterBar from '@/components/kbpolicy/PolicyFilterBar';

function useComposeData() {
  const { data: globalConfigs = [] } = useQuery({
    queryKey: ['globalConfig'],
    queryFn: () => base44.entities.GlobalConfig.list(),
  });
  const config = globalConfigs[0] || {};
  const apiUrl = (config.kb_search_data_api_url || '').replace(/\?ref=[^&]*/, '');
  const rawBaseUrl = config.kb_search_data_url || '';

  const { data: fileList = [] } = useQuery({
    queryKey: ['kbSearchFiles', apiUrl],
    queryFn: async () => { const r = await fetch(apiUrl); if (!r.ok) throw new Error(); return r.json(); },
    enabled: !!apiUrl,
  });
  const jsonFiles = fileList.filter(f => f.name?.toLowerCase().endsWith('.json'));

  const autoPolicy = jsonFiles.find(f => f.name.toLowerCase().includes('polic'))?.name || '';
  const policyFile = config.kb_policy_file || autoPolicy;

  const autoActionsFile = jsonFiles.find(f => f.name.toLowerCase().includes('action'))?.name || '';
  const actionsFile = config.kb_sub_entity_files?.actions || autoActionsFile;

  const autoConstraintsFile = jsonFiles.find(f => f.name.toLowerCase().includes('constraint'))?.name || '';
  const constraintsFile = config.kb_sub_entity_files?.constraints || autoConstraintsFile;

  const autoStatesFile = jsonFiles.find(f => f.name.toLowerCase().includes('state') || f.name.toLowerCase().includes('status'))?.name || '';
  const statesFile = config.kb_sub_entity_files?.states || autoStatesFile;

  const { data: policyData, isLoading: policiesLoading, error: policiesError } = useQuery({
    queryKey: ['kbFileContent', rawBaseUrl, policyFile],
    queryFn: async () => {
      const r = await fetch(`${rawBaseUrl}/${policyFile}?_=${Date.now()}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: !!policyFile && !!rawBaseUrl,
    staleTime: 0,
    gcTime: 0,
  });

  const { data: actionsData } = useQuery({
    queryKey: ['kbActionsContent', rawBaseUrl, actionsFile],
    queryFn: async () => { const r = await fetch(`${rawBaseUrl}/${actionsFile}?_=${Date.now()}`); if (!r.ok) throw new Error(); return r.json(); },
    enabled: !!actionsFile && !!rawBaseUrl,
    staleTime: 0,
    gcTime: 0,
  });

  const { data: constraintsData } = useQuery({
    queryKey: ['kbConstraintsContent', rawBaseUrl, constraintsFile],
    queryFn: async () => { const r = await fetch(`${rawBaseUrl}/${constraintsFile}?_=${Date.now()}`); if (!r.ok) throw new Error(); return r.json(); },
    enabled: !!constraintsFile && !!rawBaseUrl,
    staleTime: 0,
    gcTime: 0,
  });

  const { data: statesData } = useQuery({
    queryKey: ['kbStatesContent', rawBaseUrl, statesFile],
    queryFn: async () => { const r = await fetch(`${rawBaseUrl}/${statesFile}?_=${Date.now()}`); if (!r.ok) throw new Error(); return r.json(); },
    enabled: !!statesFile && !!rawBaseUrl,
    staleTime: 0,
    gcTime: 0,
  });

  const remotePolicies = policyData?.policies || (Array.isArray(policyData) ? policyData : []);

  const actionsArray = Array.isArray(actionsData) ? actionsData : (actionsData?.actions || []);
  const actionsMap = Object.fromEntries(actionsArray.map(a => [a.id, a]));

  const constraintsArray = Array.isArray(constraintsData) ? constraintsData : (constraintsData?.constraints || []);
  const constraintsMap = Object.fromEntries(constraintsArray.map(c => [c.id, c]));

  const statesArray = Array.isArray(statesData) ? statesData : (statesData?.states || []);
  // Index by both full id and the last path/colon segment so prefixed values like "openrel:status/active" resolve correctly
  const statesMap = statesArray.reduce((acc, s) => {
    if (s.id) {
      acc[s.id] = s;
      const shortKey = s.id.split(/[:/]/).pop()?.toLowerCase();
      if (shortKey && shortKey !== s.id) acc[shortKey] = s;
    }
    return acc;
  }, {});

  return {
    remotePolicies,
    actionsMap,
    constraintsMap,
    statesMap,
    policiesLoading,
    policiesError,
    noConfig: !rawBaseUrl && globalConfigs.length > 0,
    config,
    policyFile,
  };
}

export default function KBCompose() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({});
  // Local overlay: deleted ids + cloned additions
  const [deletedIds, setDeletedIds] = useState(new Set());
  const [cloned, setCloned] = useState([]);

  const { remotePolicies, actionsMap, constraintsMap, statesMap, policiesLoading, policiesError, noConfig, config, policyFile } = useComposeData();

  // Merge: remote (minus deleted) + clones
  const allPolicies = useMemo(() => {
    const base = remotePolicies.filter(p => !deletedIds.has(p.id));
    return [...base, ...cloned];
  }, [remotePolicies, deletedIds, cloned]);

  const policiesMap = useMemo(() => Object.fromEntries(allPolicies.map(p => [p.id, p])), [allPolicies]);

  const odrlTypes = useMemo(() => [...new Set(allPolicies.map(p => p.odrl_type).filter(Boolean))], [allPolicies]);
  const statuses  = useMemo(() => [...new Set(allPolicies.map(p => p.status).filter(Boolean))], [allPolicies]);

  const matchFacet = (fieldValue, facet) => {
    if (!facet?.values?.length) return true;
    if (facet.logic === 'AND') return facet.values.every(v => v === fieldValue);
    return facet.values.includes(fieldValue);
  };

  const filtered = useMemo(() => {
    return allPolicies.filter(p => {
      const q = searchQuery.toLowerCase();
      if (q && !(p.label || '').toLowerCase().includes(q) && !(p.id || '').toLowerCase().includes(q)) return false;
      if (!matchFacet(p.odrl_type, filters.odrl_type)) return false;
      if (!matchFacet(p.status, filters.status)) return false;
      return true;
    });
  }, [allPolicies, searchQuery, filters]);

  const handleEdit = (updatedPolicy) => {
    const isClone = cloned.some(c => c.id === updatedPolicy.id);
    if (isClone) {
      setCloned(prev => prev.map(c => c.id === updatedPolicy.id ? updatedPolicy : c));
    } else {
      // Promote to cloned list so edits live locally without touching the remote
      setDeletedIds(prev => new Set([...prev, updatedPolicy.id]));
      setCloned(prev => [...prev, updatedPolicy]);
    }
    toast({ title: 'Policy updated', description: `"${updatedPolicy.label}" saved as draft.` });
  };

  const handleCopy = (policy) => {
    const newId = `${policy.id}-copy-${Date.now()}`;
    const copy = { ...policy, id: newId, label: `${policy.label} (copy)`, status: 'openrel:status/draft', derived_from: policy.id };
    setCloned(prev => [...prev, copy]);
    toast({ title: 'Policy copied', description: `Created "${copy.label}"` });
  };

  const handleSubmitPR = async (policy) => {
    const repo = config.github_repo;
    const branch = config.github_branch || 'main';
    if (!repo || !policyFile) {
      toast({ title: 'Configuration missing', description: 'GitHub repo or policy file not configured.', variant: 'destructive' });
      return;
    }
    const filePath = `${(config.github_output_folder || 'data').replace(/\/$/, '')}/${policyFile}`;
    const res = await base44.functions.invoke('submitPolicyPR', { policy, repo, branch, filePath });
    if (res.data?.success) {
      // Update local status to pending
      handleEdit({ ...policy, status: 'openrel:status/pending' });
      toast({
        title: 'Pull request created',
        description: (
          <a href={res.data.pr_url} target="_blank" rel="noopener noreferrer" className="underline text-primary">
            View PR #{res.data.pr_number}
          </a>
        ),
      });
    } else {
      toast({ title: 'PR failed', description: res.data?.error || 'Unknown error', variant: 'destructive' });
    }
  };

  const handleDelete = (policy) => {
    // If it's a clone, remove from cloned list; otherwise mark as deleted
    const isClone = cloned.some(c => c.id === policy.id);
    if (isClone) {
      setCloned(prev => prev.filter(c => c.id !== policy.id));
    } else {
      setDeletedIds(prev => new Set([...prev, policy.id]));
    }
    toast({ title: 'Policy removed', description: `"${policy.label}" removed from this view.` });
  };

  if (noConfig) {
    return (
      <div className="space-y-5 max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight">Compose</h1>
        <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          No data source configured. Go to{' '}
          <Link to="/kb-user/configuration" className="text-primary underline underline-offset-2">Configuration</Link>{' '}
          to set up your repository URL and file assignments.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compose</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create, edit, copy, or delete policies from the knowledge base.
          </p>
        </div>
        <Button size="sm" className="gap-1.5 shrink-0 mt-1" disabled title="Create new policy (coming soon)">
          <Plus className="w-4 h-4" /> New Policy
        </Button>
      </div>

      <PolicyFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        onFiltersChange={setFilters}
        odrlTypes={odrlTypes}
        statuses={statuses}
      />

      {policiesLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading policies…
        </div>
      )}

      {policiesError && (
        <div className="text-sm text-destructive py-4">Failed to load policies: {policiesError.message}</div>
      )}

      {!policiesLoading && !policiesError && (
        <>
          <div className="space-y-2">
            {filtered.map(policy => (
              <ComposePolicyCard
                key={policy.id}
                policy={policy}
                actionsMap={actionsMap}
                constraintsMap={constraintsMap}
                statesMap={statesMap}
                policiesMap={policiesMap}
                onEdit={handleEdit}
                onCopy={handleCopy}
                onDelete={handleDelete}
                onSubmitPR={handleSubmitPR}
              />
            ))}
            {filtered.length === 0 && (
              <div className="text-sm text-muted-foreground py-8 text-center">
                {searchQuery ? 'No policies match your search.' : 'No policies found.'}
              </div>
            )}
          </div>
          {filtered.length > 0 && (
            <p className="text-xs text-muted-foreground text-right pt-1">
              {filtered.length} of {allPolicies.length} policies
            </p>
          )}
        </>
      )}
    </div>
  );
}