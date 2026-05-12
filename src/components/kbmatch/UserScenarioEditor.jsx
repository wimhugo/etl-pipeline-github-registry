import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import ScenarioGroupCard from '@/components/kbsearch/ScenarioGroupCard';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

export default function UserScenarioEditor({ scenario, onClose }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [label, setLabel] = useState(scenario?.label || 'New Scenario');
  const [description, setDescription] = useState(scenario?.description || '');
  const [selectedIds, setSelectedIds] = useState(() => {
    const ids = scenario?.selected_scenario_ids || [];
    return Object.fromEntries(ids.map(id => [id, true]));
  });

  // Load config
  const { data: globalConfigs = [] } = useQuery({
    queryKey: ['globalConfig'],
    queryFn: () => base44.entities.GlobalConfig.list(),
  });
  const config = globalConfigs[0] || {};
  const rawBaseUrl = config.kb_search_data_url || '';
  const apiUrl = (config.kb_search_data_api_url || '').replace(/\?ref=[^&]*/, '');

  const { data: fileList = [] } = useQuery({
    queryKey: ['kbMatchFiles', apiUrl],
    queryFn: async () => {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error('Failed to fetch file list');
      return res.json();
    },
    enabled: !!apiUrl,
  });

  const jsonFiles = fileList.filter(f => f.name?.toLowerCase().endsWith('.json'));
  const autoScenariosFile = jsonFiles.find(f => f.name.toLowerCase().includes('scenario'))?.name || '';
  const scenariosFile = config.kb_sub_entity_files?.scenarios || autoScenariosFile;

  const { data: scenariosData, isLoading, error } = useQuery({
    queryKey: ['kbScenariosContent', rawBaseUrl, scenariosFile],
    queryFn: async () => {
      const res = await fetch(`${rawBaseUrl}/${scenariosFile}`);
      if (!res.ok) throw new Error('Failed to fetch scenarios file');
      return res.json();
    },
    enabled: !!scenariosFile && !!rawBaseUrl && globalConfigs.length > 0,
  });

  const scenarioGroupsKey = scenariosData
    ? Object.keys(scenariosData).find(k => k.trim() === 'scenarioGroups')
    : null;
  const scenarioGroups = (scenarioGroupsKey ? scenariosData[scenarioGroupsKey] : null)
    || (Array.isArray(scenariosData) ? scenariosData : []);

  const handleToggle = (id) => {
    setSelectedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const saveMutation = useMutation({
    mutationFn: (data) =>
      scenario
        ? base44.entities.UserScenario.update(scenario.id, data)
        : base44.entities.UserScenario.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userScenarios'] });
      toast({ title: 'Saved', description: 'User scenario saved.' });
      onClose();
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      label,
      description,
      selected_scenario_ids: Object.entries(selectedIds)
        .filter(([, v]) => v)
        .map(([k]) => k),
    });
  };

  const selectedCount = Object.values(selectedIds).filter(Boolean).length;

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {scenario ? 'Edit Scenario' : 'New Scenario'}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Select scenario groups, then save.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          {selectedCount > 0 && (
            <span className="text-xs text-muted-foreground bg-muted/50 border border-border/50 rounded-full px-3 py-1">
              {selectedCount} selected
            </span>
          )}
          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saveMutation.isPending}>
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-border/50 bg-card px-4 py-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Label</Label>
          <Input
            className="bg-muted/50"
            value={label}
            onChange={e => setLabel(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Description</Label>
          <Textarea
            className="bg-muted/50 resize-none text-sm"
            rows={2}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>
      </div>

      {/* Scenario groups */}
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
        <div className="text-sm text-destructive py-4">Failed to load scenarios: {error.message}</div>
      )}

      {!isLoading && !error && scenarioGroups.length === 0 && scenariosFile && (
        <div className="text-sm text-muted-foreground py-8 text-center">No scenario groups found in this file.</div>
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