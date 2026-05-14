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

  const policies = fileData?.policies || (Array.isArray(fileData) ? fileData : []);

  // Derive distinct filter values from data and notify parent
  useEffect(() => {
    if (!policies.length || !onDataReady) return;
    const odrlTypes = [...new Set(policies.map(p => p.odrl_type).filter(Boolean))];
    const statuses  = [...new Set(policies.map(p => p.status).filter(Boolean))];
    onDataReady({ odrlTypes, statuses });
  }, [policies.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = policies.filter(p => {
    const q = searchQuery.toLowerCase();
    if (q && !(p.label || '').toLowerCase().includes(q) && !(p.id || '').toLowerCase().includes(q)) return false;
    if (advancedFilters.odrl_type && p.odrl_type !== advancedFilters.odrl_type) return false;
    if (advancedFilters.status && p.status !== advancedFilters.status) return false;
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
        <PolicyCard key={policy.id} policy={policy} actionsMap={actionsMap} constraintsMap={constraintsMap} />
      ))}
      <p className="text-xs text-muted-foreground text-right pt-1">
        {filtered.length} of {policies.length} policies
      </p>
    </div>
  );
}