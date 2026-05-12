import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ShieldCheck, ShieldOff, Gavel } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

function RuleSection({ icon: Icon, label, color, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-3">
      <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-1.5 ${color}`}>
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="space-y-1.5 pl-2 border-l border-border/50">
        {items.map((item, i) => (
          <div key={i} className="text-xs space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-muted-foreground">action:</span>
              <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                {item.action}
              </Badge>
            </div>
            {item.constraint && (
              <div className="flex items-center gap-1.5 flex-wrap pl-2">
                <span className="text-muted-foreground">constraint:</span>
                <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 border-dashed">
                  {item.constraint.id || `${item.constraint.leftOperand} ${item.constraint.operator} ${String(item.constraint.rightOperand)}`}
                </Badge>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PolicyCard({ policy }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
      {/* Header — always visible */}
      <button
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="mt-0.5 text-muted-foreground">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-foreground">{policy.label}</span>
            {policy.odrl_type && (
              <Badge className="text-[10px] px-1.5 py-0 bg-primary/15 text-primary border-primary/30 font-normal">
                {policy.odrl_type}
              </Badge>
            )}
          </div>
          <div className="font-mono text-[11px] text-muted-foreground mt-0.5 truncate">{policy.id}</div>
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border/40 bg-muted/10">
          <RuleSection
            icon={ShieldCheck}
            label="Permissions"
            color="text-accent"
            items={policy.permissions}
          />
          <RuleSection
            icon={ShieldOff}
            label="Prohibitions"
            color="text-destructive"
            items={policy.prohibitions}
          />
          <RuleSection
            icon={Gavel}
            label="Duties"
            color="text-yellow-400"
            items={policy.duties}
          />
        </div>
      )}
    </div>
  );
}