import React, { useState } from 'react';
import { Pencil, Copy, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function UserScenarioCard({ scenario, scenarioLabelMap = {}, onEdit, onClone, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const ids = scenario.selected_scenario_ids || [];
  const count = ids.length;

  return (
    <div className="w-full rounded-lg border border-border/60 bg-card overflow-hidden">
      {/* Header row */}
      <div className="flex items-start gap-2 px-4 py-3">
        <button
          className="flex items-start gap-2 flex-1 min-w-0 text-left"
          onClick={() => setExpanded(e => !e)}
        >
          <span className="mt-0.5 shrink-0">
            {expanded
              ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
              : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-foreground">{scenario.label}</span>
              <Badge variant="outline" className="text-[10px] px-2 py-0 shrink-0">
                {count} scenario{count !== 1 ? 's' : ''}
              </Badge>
            </div>
            {scenario.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{scenario.description}</p>
            )}
          </div>
        </button>

        <div className="flex items-center gap-0.5 shrink-0">
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

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border/40 bg-muted/10 px-4 py-3 space-y-2">
          {scenario.description && (
            <p className="text-xs text-muted-foreground mb-2">{scenario.description}</p>
          )}
          {ids.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic">No scenarios selected.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {ids.map(id => (
                <span
                  key={id}
                  className="inline-flex items-center rounded-full border border-border/50 bg-muted/40 px-2.5 py-0.5 text-xs text-foreground/80 font-mono"
                >
                  {scenarioLabelMap[id] || id}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}