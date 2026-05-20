import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FacetCard from '@/components/kbsearch/FacetCard';
import FacetEditDialog from '@/components/kbsearch/FacetEditDialog';

export default function FacetConfigEditor() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null); // null | 'new' | facet record

  const { data: facets = [], isLoading } = useQuery({
    queryKey: ['facetConfigs'],
    queryFn: () => base44.entities.FacetConfig.list('sort_order', 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.FacetConfig.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['facetConfigs'] }); setEditing(null); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FacetConfig.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['facetConfigs'] }); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FacetConfig.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['facetConfigs'] }),
  });

  const moveFacet = (facet, direction) => {
    const sorted = [...facets].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const idx = sorted.findIndex(f => f.id === facet.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swapWith = sorted[swapIdx];
    const aOrder = facet.sort_order ?? idx;
    const bOrder = swapWith.sort_order ?? swapIdx;
    updateMutation.mutate({ id: facet.id, data: { sort_order: bOrder } });
    updateMutation.mutate({ id: swapWith.id, data: { sort_order: aOrder } });
  };

  const toggleActive = (facet) => {
    updateMutation.mutate({ id: facet.id, data: { is_active: !facet.is_active } });
  };

  const sorted = [...facets].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Facet Configuration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define and arrange the filter facets shown in the Policy Search panel.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setEditing('new')}>
          <Plus className="w-4 h-4" /> Add Facet
        </Button>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading facets…</p>
      )}

      {!isLoading && sorted.length === 0 && (
        <div className="rounded-lg border border-border/50 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          No facets configured yet. Click <strong>Add Facet</strong> to get started.
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((facet, idx) => (
          <FacetCard
            key={facet.id}
            facet={facet}
            isFirst={idx === 0}
            isLast={idx === sorted.length - 1}
            onEdit={() => setEditing(facet)}
            onDelete={() => deleteMutation.mutate(facet.id)}
            onMoveUp={() => moveFacet(facet, -1)}
            onMoveDown={() => moveFacet(facet, 1)}
            onToggleActive={() => toggleActive(facet)}
          />
        ))}
      </div>

      {editing && (
        <FacetEditDialog
          facet={editing === 'new' ? null : editing}
          existingCount={facets.length}
          onSave={(data) => {
            if (editing === 'new') createMutation.mutate(data);
            else updateMutation.mutate({ id: editing.id, data });
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}