import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import UserScenarioCard from '@/components/kbmatch/UserScenarioCard';
import UserScenarioEditor from '@/components/kbmatch/UserScenarioEditor';

function useKBMatchData() {
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

  // Scenarios
  const autoScenariosFile = jsonFiles.find(f => f.name.toLowerCase().includes('scenario'))?.name || '';
  const scenariosFile = config.kb_sub_entity_files?.scenarios || autoScenariosFile;
  const { data: scenariosData } = useQuery({
    queryKey: ['kbScenariosContent', rawBaseUrl, scenariosFile],
    queryFn: async () => { const r = await fetch(`${rawBaseUrl}/${scenariosFile}`); if (!r.ok) throw new Error(); return r.json(); },
    enabled: !!scenariosFile && !!rawBaseUrl && globalConfigs.length > 0,
  });
  const sgKey = scenariosData ? Object.keys(scenariosData).find(k => k.trim() === 'scenarioGroups') : null;
  const groups = (sgKey ? scenariosData[sgKey] : null) || (Array.isArray(scenariosData) ? scenariosData : []);
  const labelMap = {};
  for (const group of groups) {
    for (const s of group.scenarios || []) {
      if (s.id) labelMap[s.id] = s.label || s.id;
    }
  }

  // Constraints
  const autoConstraintsFile = jsonFiles.find(f => f.name.toLowerCase().includes('constraint'))?.name || '';
  const constraintsFile = config.kb_sub_entity_files?.constraints || autoConstraintsFile;
  const { data: constraintsData, isLoading: constraintsLoading } = useQuery({
    queryKey: ['kbConstraintsContent', rawBaseUrl, constraintsFile],
    queryFn: async () => { const r = await fetch(`${rawBaseUrl}/${constraintsFile}`); if (!r.ok) throw new Error(); return r.json(); },
    enabled: !!constraintsFile && !!rawBaseUrl,
  });
  const constraintsArray = Array.isArray(constraintsData) ? constraintsData : (constraintsData?.constraints || []);

  // Policies
  const autoPolicyFile = jsonFiles.find(f => f.name.toLowerCase().includes('polic'))?.name || '';
  const policyFile = config.kb_policy_file || autoPolicyFile;
  const { data: policyData, isLoading: policiesLoading } = useQuery({
    queryKey: ['kbFileContent', rawBaseUrl, policyFile],
    queryFn: async () => { const r = await fetch(`${rawBaseUrl}/${policyFile}`); if (!r.ok) throw new Error(); return r.json(); },
    enabled: !!policyFile && !!rawBaseUrl,
  });
  const policies = policyData?.policies || (Array.isArray(policyData) ? policyData : []);

  const dataReady = !constraintsLoading && !policiesLoading && constraintsArray.length > 0 && policies.length > 0;

  return { labelMap, constraintsArray, policies, dataReady };
}

export default function KBMatch() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const { labelMap: scenarioLabelMap, constraintsArray, policies, dataReady } = useKBMatchData();

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
            constraintsArray={constraintsArray}
            policies={policies}
            dataReady={dataReady}
            onEdit={() => setEditingId(s.id)}
            onClone={() => cloneMutation.mutate(s)}
            onDelete={() => deleteMutation.mutate(s.id)}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ['userScenarios'] })}
          />
        ))}
      </div>
    </div>
  );
}