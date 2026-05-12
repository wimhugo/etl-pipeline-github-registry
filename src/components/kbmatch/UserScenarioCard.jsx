import React from 'react';
import { Pencil, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function UserScenarioCard({ scenario, onEdit, onClone, onDelete }) {
  const count = scenario.selected_scenario_ids?.length || 0;

  return (
    <div className="rounded-lg border border-border/60 bg-card px-4 py-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate">{scenario.label}</p>
        {scenario.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{scenario.description}</p>
        )}
        <p className="text-xs text-muted-foreground/60 mt-1">{count} scenario{count !== 1 ? 's' : ''} selected</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} title="Edit">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClone} title="Clone">
          <Copy className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete} title="Delete">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}