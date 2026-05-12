import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import ScenarioGroupCard from '@/components/kbsearch/ScenarioGroupCard';

export default function KBMatch() {
  const [selectedIds, setSelectedIds] = useState({});

  const { data: globalConfigs = [] } = useQuery({
    queryKey: ['globalConfig'],
    queryFn: () => base44.entities.GlobalConfig.list(),
  });
  const config = globalConfigs[0] || {};
  const rawBaseUrl = config.kb_search_data_url || 'https://raw.githubusercontent.com/wimhugo/openrel/main/data/input/v0.3';
  const scenariosFile = config.kb_sub_entity_files?.scenarios || '';

  const { data: scenariosData, isLoading, error } = useQuery({
    queryKey: ['kbScenariosContent', rawBaseUrl, scenariosFile],
    queryFn: async () => {
      const res = await fetch(`${rawBaseUrl}/${scenariosFile}`);
      if (!res.ok) throw new Error('Failed to fetch scenarios file');
      return res.json();
    },
    enabled: !!scenariosFile && !!rawBaseUrl,
  });

  const scenarioGroups = scenariosData?.scenarioGroups || (Array.isArray(scenariosData) ? scenariosData : []);

  const handleToggle = (id) => {
    setSelectedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const selectedCount = Object.values(selectedIds).filter(Boolean).length;

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Match</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse scenario groups and select scenarios to match against the knowledge base.
          </p>
        </div>
        {selectedCount > 0 && (
          <span className="text-xs text-muted-foreground bg-muted/50 border border-border/50 rounded-full px-3 py-1 shrink-0 mt-1">
            {selectedCount} selected
          </span>
        )}
      </div>

      {!scenariosFile && (
        <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          No scenarios file configured. Go to{' '}
          <Link to="/kb-user/configuration" className="text-primary underline underline-offset-2">Configuration</Link>{' '}
          to assign a scenarios file.
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading scenarios…
        </div>
      )}

      {error && (
        <div className="text-sm text-destructive py-4">
          Failed to load scenarios: {error.message}
        </div>
      )}

      {!isLoading && !error && scenarioGroups.length === 0 && scenariosFile && (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No scenario groups found in this file.
        </div>
      )}

      <div className="space-y-2">
        {scenarioGroups.map((group, i) => (
          <ScenarioGroupCard
            key={group.id || i}
            group={group}
            selectedIds={selectedIds}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </div>
  );
}