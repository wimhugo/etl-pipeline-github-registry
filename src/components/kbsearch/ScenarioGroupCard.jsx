import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

function IdPill({ id }) {
  if (!id) return null;
  return (
    <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 text-primary font-mono text-[10px] px-2 py-0 cursor-pointer hover:bg-primary/20 transition-colors">
      {id}
    </span>
  );
}

export default function ScenarioGroupCard({ group, selectedIds, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  const scenarios = group.scenarios || [];

  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-muted-foreground shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-foreground">{group.label}</span>
          <IdPill id={group.id} />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {scenarios.length} scenario{scenarios.length !== 1 ? 's' : ''}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border/40 bg-muted/10 divide-y divide-border/30">
          {scenarios.map((scenario, i) => (
            <label
              key={scenario.id || i}
              className="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors"
            >
              <Checkbox
                checked={!!selectedIds[scenario.id]}
                onCheckedChange={() => onToggle(scenario.id)}
              />
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-sm text-foreground">{scenario.label}</span>
                <IdPill id={scenario.id} />
              </div>
            </label>
          ))}
          {scenarios.length === 0 && (
            <p className="px-5 py-3 text-xs text-muted-foreground">No scenarios in this group.</p>
          )}
        </div>
      )}
    </div>
  );
}