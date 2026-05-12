import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import ConstraintCard from './ConstraintCard';

export default function KBConstraintList({ searchQuery = '' }) {
  const { data: globalConfigs = [] } = useQuery({
    queryKey: ['globalConfig'],
    queryFn: () => base44.entities.GlobalConfig.list(),
  });
  const config = globalConfigs[0] || {};
  const rawBaseUrl = config.kb_search_data_url || '';
  const apiUrl = (config.kb_search_data_api_url || '').replace(/\?ref=[^&]*/, '');

  const { data: fileList = [] } = useQuery({
    queryKey: ['kbSearchFiles', apiUrl],
    queryFn: async () => { const r = await fetch(apiUrl); if (!r.ok) throw new Error(); return r.json(); },
    enabled: !!apiUrl,
  });
  const jsonFiles = fileList.filter(f => f.name?.toLowerCase().endsWith('.json'));
  const autoFile = jsonFiles.find(f => f.name.toLowerCase().includes('constraint'))?.name || '';
  const constraintsFile = config.kb_sub_entity_files?.constraints || autoFile;

  const { data, isLoading, error } = useQuery({
    queryKey: ['kbConstraintsContent', rawBaseUrl, constraintsFile],
    queryFn: async () => { const r = await fetch(`${rawBaseUrl}/${constraintsFile}`); if (!r.ok) throw new Error(); return r.json(); },
    enabled: !!constraintsFile && !!rawBaseUrl,
  });

  const allConstraints = Array.isArray(data) ? data : (data?.constraints || []);
  const constraints = allConstraints.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (c.label || '').toLowerCase().includes(q) || (c.id || '').toLowerCase().includes(q);
  });

  if (!rawBaseUrl && globalConfigs.length > 0) {
    return (
      <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        No data source configured. Go to{' '}
        <Link to="/kb-user/configuration" className="text-primary underline underline-offset-2">Configuration</Link>{' '}
        to set up your repository.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading constraints…
      </div>
    );
  }

  if (error) {
    return <div className="text-sm text-destructive py-4">Failed to load constraints: {error.message}</div>;
  }

  if (constraints.length === 0) {
    return <div className="text-sm text-muted-foreground py-8 text-center">{searchQuery ? 'No constraints match your search.' : 'No constraints found in this file.'}</div>;
  }

  return (
    <div className="space-y-2">
      {constraints.map((constraint, i) => (
        <ConstraintCard key={constraint.id || i} constraint={constraint} />
      ))}
      <p className="text-xs text-muted-foreground text-right pt-1">{constraints.length} of {allConstraints.length} constraints</p>
    </div>
  );
}