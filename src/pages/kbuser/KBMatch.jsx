import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import UserScenarioCard from '@/components/kbmatch/UserScenarioCard';
import UserScenarioEditor from '@/components/kbmatch/UserScenarioEditor';

export default function KBMatch() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null); // null = list, 'new' = new, id = edit

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
    <div className="space-y-5 max-w-2xl">
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
            onEdit={() => setEditingId(s.id)}
            onClone={() => cloneMutation.mutate(s)}
            onDelete={() => deleteMutation.mutate(s.id)}
          />
        ))}
      </div>
    </div>
  );
}