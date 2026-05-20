import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import PolicyCard from '@/components/kbsearch/PolicyCard';
import { Link } from 'react-router-dom';

/**
 * Reusable policy listing with optional search + advanced filters.
 * Props:
 *   searchQuery: string
 *   advancedFilters: { odrl_type?: string, status?: string }
 *   onDataReady: ({ odrlTypes, statuses }) => void  – called once data is loaded
 */
export default function KBPolicyList({ searchQuery = '', advancedFilters = {}, onDataReady }) {
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

  const autoStatesFile = jsonFiles.find(f => f.name.toLowerCase().includes('state'))?.name || '';
  const statesFile = config.kb_sub_entity_files?.states || autoStatesFile;

  const { data: actionsData } = useQuery({
    queryKey: ['kbActionsContent', rawBaseUrl, actionsFile],
    queryFn: async () => { const r = await fetch(`${rawBaseUrl}/${actionsFile}`); if (!r.ok) throw new Error(); return r.json(); },
    enabled: !!actionsFile && !!rawBaseUrl,
  });

  const { data: constraintsData } = useQuery({
    queryKey: ['kbConstraintsContent', rawBaseUrl, constraintsFile],
    queryFn: async () => { const r = await fetch(`${rawBaseUrl}/${constraintsFile}`); if (!r.ok) throw new Error(); return r.json(); },
    enabled: !!constraintsFile && !!rawBaseUrl,
  });

  const { data: statesData } = useQuery({
    queryKey: ['kbStatesContent', rawBaseUrl, statesFile],
    queryFn: async () => { const r = await fetch(`${rawBaseUrl}/${statesFile}`); if (!r.ok) throw new Error(); return r.json(); },
    enabled: !!statesFile && !!rawBaseUrl,
  });

  const { data: fileData, isLoading, error } = useQuery({
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

  const policies = fileData?.policies || (Array.isArray(fileData) ? fileData : []);
  const policiesMap = Object.fromEntries(policies.map(p => [p.id, p]));

  // Derive distinct filter values + counts from data and notify parent
  useEffect(() => {
    if (!onDataReady) return;
    const isPlaceholder = (value) => /^{{.*}}$|^<.*>$/.test(value);

    const odrlTypes = [...new Set(policies.map(p => p.odrl_type).filter(Boolean).filter(v => !isPlaceholder(v)))];
    const statusesFromStates = statesArray.map(s => s.id).filter(Boolean).filter(v => !isPlaceholder(v));
    const statusesFromPolicies = policies.map(p => p.status).filter(Boolean).filter(v => !isPlaceholder(v));
    const statuses = [...new Set([...statusesFromStates, ...statusesFromPolicies])];

    // Count occurrences per field value across all policies
    const countField = (fieldFn) =>
      policies.reduce((acc, p) => {
        const v = fieldFn(p);
        if (v && !isPlaceholder(v)) acc[v] = (acc[v] || 0) + 1;
        return acc;
      }, {});

    const countsByField = {
      odrl_type: countField(p => p.odrl_type),
      status: countField(p => p.status),
    };

    onDataReady({ odrlTypes, statuses, countsByField });
  }, [policies.length, statesArray.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const matchFacet = (fieldValue, facet) => {
    if (!facet?.values?.length) return true;
    if (facet.logic === 'AND') return facet.values.every(v => v === fieldValue);
    return facet.values.includes(fieldValue); // OR
  };

  const filtered = policies.filter(p => {
    const q = searchQuery.toLowerCase();
    if (q && !(p.label || '').toLowerCase().includes(q) && !(p.id || '').toLowerCase().includes(q)) return false;
    if (!matchFacet(p.odrl_type, advancedFilters.odrl_type)) return false;
    if (!matchFacet(p.status, advancedFilters.status)) return false;
    return true;
  });

  const noConfig = !rawBaseUrl;

  if (noConfig && globalConfigs.length > 0) {
    return (
      <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        No data source configured. Go to{' '}
        <Link to="/kb-user/configuration" className="text-primary underline underline-offset-2">Configuration</Link>{' '}
        to set up your repository URL and file assignments.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading policies…
      </div>
    );
  }

  if (error) {
    return <div className="text-sm text-destructive py-4">Failed to load policies: {error.message}</div>;
  }

  if (filtered.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        {searchQuery ? 'No policies match your search.' : 'No policies found in this file.'}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map(policy => (
        <PolicyCard key={policy.id} policy={policy} actionsMap={actionsMap} constraintsMap={constraintsMap} statesMap={statesMap} policiesMap={policiesMap} />
      ))}
      <p className="text-xs text-muted-foreground text-right pt-1">
        {filtered.length} of {policies.length} policies
      </p>
    </div>
  );
}