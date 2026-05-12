import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import UserScenarioCard from '@/components/kbmatch/UserScenarioCard';
import UserScenarioEditor from '@/components/kbmatch/UserScenarioEditor';

function useScenarioLabelMap() {
  const { data: globalConfigs = [] } = useQuery({
    queryKey: ['globalConfig'],
    queryFn: () => base44.entities.GlobalConfig.list(),
  });
  const config = globalConfigs[0] || {};
  const rawBaseUrl = config.kb_search_data_url || '';
  const apiUrl = (config.kb_search_data_api_url || '').replace(/\?ref=[^&]*/, '');

  const { data: fileList = [] } = useQuery({
    queryKey: ['kbMatchFiles', apiUrl],
    queryFn: async () => { const r = await fetch(apiUrl); if (!r.ok) throw new Error(); return r.json(); },
    enabled: !!apiUrl,
  });
  const jsonFiles = fileList.filter(f => f.name?.toLowerCase().endsWith('.json'));
  const autoFile = jsonFiles.find(f => f.name.toLowerCase().includes('scenario'))?.name || '';
  const scenariosFile = config.kb_sub_entity_files?.scenarios || autoFile;

  const { data: scenariosData } = useQuery({
    queryKey: ['kbScenariosContent', rawBaseUrl, scenariosFile],
    queryFn: async () => { const r = await fetch(`${rawBaseUrl}/${scenariosFile}`); if (!r.ok) throw new Error(); return r.json(); },
    enabled: !!scenariosFile && !!rawBaseUrl && globalConfigs.length > 0,
  });

  const key = scenariosData ? Object.keys(scenariosData).find(k => k.trim() === 'scenarioGroups') : null;
  const groups = (key ? scenariosData[key] : null) || (Array.isArray(scenariosData) ? scenariosData : []);

  const labelMap = {};
  for (const group of groups) {
    for (const s of group.scenarios || []) {
      if (s.id) labelMap[s.id] = s.label || s.id;
    }
  }
  return labelMap;
}

export default function KBMatch() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const scenarioLabelMap = useScenarioLabelMap(); // null = list, 'new' = new, id = edit

  const { data: scenarios = [], isLoading } = useQuery({
    queryKey: ['userScenarios'],
    queryFn: () => base44.entities.UserScenario.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.UserScenario.create(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['userScenarios'] });
      setEditingId(created.id);
    },
  });

  const cloneMutation = useMutation({
    mutationFn: ({ label, description, selected_scenario_ids }) =>
      base44.entities.UserScenario.create({
        label: `${label} (copy)`,
        description,
        selected_scenario_ids: selected_scenario_ids || [],
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userScenarios'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.UserScenario.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userScenarios'] }),
  });

  if (editingId) {
    const scenario = editingId === 'new' ? null : scenarios.find(s => s.id === editingId);
    return (
      <UserScenarioEditor
        scenario={scenario}
        onClose={() => setEditingId(null)}
      />
    );
  }

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Match</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage user-defined scenario sets to match against the knowledge base.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5 shrink-0 mt-1"
          onClick={() => createMutation.mutate({ label: 'New Scenario', description: '', selected_scenario_ids: [] })}
          disabled={createMutation.isPending}
        >
          <Plus className="w-4 h-4" /> New
        </Button>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {!isLoading && scenarios.length === 0 && (
        <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          No user scenarios yet. Click <strong>New</strong> to create one.
        </div>
      )}

      <div className="space-y-3">
        {scenarios.map(s => (
          <UserScenarioCard
            key={s.id}
            scenario={s}
            scenarioLabelMap={scenarioLabelMap}
            onEdit={() => setEditingId(s.id)}
            onClone={() => cloneMutation.mutate(s)}
            onDelete={() => deleteMutation.mutate(s.id)}
          />
        ))}
      </div>
    </div>
  );
}