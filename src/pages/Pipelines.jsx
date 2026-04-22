import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, GitBranch } from 'lucide-react';
import PipelineCard from '../components/pipelines/PipelineCard';
import PipelineForm from '../components/pipelines/PipelineForm';
import EmptyState from '../components/shared/EmptyState';
import { useProject } from '@/lib/ProjectContext';

export default function Pipelines() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const { activeProject } = useProject();

  const { data: allPipelines = [], isLoading } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => base44.entities.Pipeline.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Pipeline.create({
      ...data,
      project_id: activeProject?.id || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      setShowForm(false);
    },
  });

  const pipelines = activeProject
    ? allPipelines.filter(p => p.project_id === activeProject.id)
    : allPipelines.filter(p => !p.project_id);

  const filtered = pipelines.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipelines</h1>
          <p className="text-sm text-muted-foreground mt-1">{pipelines.length} pipelines configured</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus className="w-4 h-4" />
          New Pipeline
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search pipelines..."
          className="pl-9 bg-muted/50 text-sm"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-40 rounded-lg bg-card animate-pulse border border-border/50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title={search ? 'No matches' : 'No pipelines yet'}
          description={search ? 'Try a different search term.' : 'Create your first ETL pipeline to start moving data.'}
          actionLabel={!search ? 'Create Pipeline' : undefined}
          onAction={!search ? () => setShowForm(true) : undefined}
        />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => <PipelineCard key={p.id} pipeline={p} />)}
        </div>
      )}

      <PipelineForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={(data) => createMutation.mutate(data)}
      />
    </div>
  );
}