import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ShieldCheck, ShieldOff, Gavel, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

function ActionDetail({ actionId, actionsMap }) {
  const action = actionsMap?.[actionId];
  if (!action) {
    return (
      <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
        {actionId}
      </Badge>
    );
  }
  return (
    <div className="rounded-md border border-border/40 bg-muted/20 px-2.5 py-2 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-foreground">{action.label}</span>
        {action.id && (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 text-primary font-mono text-[10px] px-2 py-0 cursor-pointer hover:bg-primary/20 transition-colors">
            {action.id}
          </span>
        )}
        {action.odrl_mapping && (
          <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 text-accent font-mono text-[10px] px-2 py-0 cursor-pointer hover:bg-accent/20 transition-colors">
            <ExternalLink className="w-2.5 h-2.5" />
            {action.odrl_mapping}
          </span>
        )}
      </div>
{(action.description || action.definition || action.comment) && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {action.description || action.definition || action.comment}
        </p>
      )}
    </div>
  );
}

function ConstraintDetail({ constraint, constraintsMap }) {
  if (!constraint) return null;
  // Merge inline constraint with looked-up definition from constraintsMap
  const looked = constraintsMap?.[constraint.id] || {};
  const label = looked.label || constraint.label;
  const description = looked.description || looked.definition || looked.comment || constraint.description || constraint.definition || constraint.comment;
  const id = constraint.id;
  const fallback = constraint.leftOperand ? `${constraint.leftOperand} ${constraint.operator} ${String(constraint.rightOperand)}` : null;

  if (!label && !description) {
    return (
      <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 border-dashed">
        {id || fallback}
      </Badge>
    );
  }

  return (
    <div className="rounded-md border border-border/40 bg-muted/20 px-2.5 py-2 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        {label && <span className="text-xs font-medium text-foreground">{label}</span>}
        {id && (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 text-primary font-mono text-[10px] px-2 py-0 cursor-pointer hover:bg-primary/20 transition-colors">
            {id}
          </span>
        )}
      </div>
      {description && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
      )}
      {!label && !id && (
        <span className="font-mono text-[10px] text-muted-foreground">{fallback}</span>
      )}
    </div>
  );
}

function RuleSection({ icon: Icon, label, color, items, actionsMap, constraintsMap }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-3">
      <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-2 ${color}`}>
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="space-y-2 pl-2 border-l border-border/50">
        {items.map((item, i) => (
          <div key={i} className="text-xs space-y-1">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-muted-foreground text-[10px] uppercase tracking-wider">action</span>
            </div>
            <ActionDetail actionId={item.action} actionsMap={actionsMap} />
            {item.constraint && (
              <div className="pl-1 mt-1 space-y-1">
                <span className="text-muted-foreground text-[10px] uppercase tracking-wider">constraint</span>
                <ConstraintDetail constraint={item.constraint} constraintsMap={constraintsMap} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PolicyCard({ policy, actionsMap, constraintsMap }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
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

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border/40 bg-muted/10">
          <RuleSection icon={ShieldCheck} label="Permissions"  color="text-accent"       items={policy.permissions}  actionsMap={actionsMap} constraintsMap={constraintsMap} />
          <RuleSection icon={ShieldOff}  label="Prohibitions" color="text-destructive"  items={policy.prohibitions} actionsMap={actionsMap} constraintsMap={constraintsMap} />
          <RuleSection icon={Gavel}      label="Duties"       color="text-yellow-400"   items={policy.duties}       actionsMap={actionsMap} constraintsMap={constraintsMap} />
        </div>
      )}
    </div>
  );
}