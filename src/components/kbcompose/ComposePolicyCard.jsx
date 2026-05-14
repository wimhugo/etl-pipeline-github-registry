import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ShieldCheck, ShieldOff, Gavel, Copy, Trash2, Pencil, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import PolicyEditor from '@/components/kbcompose/PolicyEditor';

function normalizeId(id) {
  return String(id || '').replace(/[.\-]/g, ':').toLowerCase();
}

function lookupInMap(id, map) {
  if (!map || !id) return null;
  if (map[id]) return map[id];
  const normId = normalizeId(id);
  return Object.values(map).find(v => normalizeId(v.id) === normId) || null;
}

function ActionDetail({ actionId, actionsMap }) {
  const action = lookupInMap(actionId, actionsMap);
  if (!action) {
    return (
      <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">{actionId}</Badge>
    );
  }
  return (
    <div className="rounded-md border border-border/40 bg-muted/20 px-2.5 py-2 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-foreground">{action.label}</span>
        {action.id && (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 text-primary font-mono text-[10px] px-2 py-0">
            {action.id}
          </span>
        )}
        {action.odrl_mapping && (
          <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 text-accent font-mono text-[10px] px-2 py-0">
            <ExternalLink className="w-2.5 h-2.5" />
            {action.odrl_mapping}
          </span>
        )}
      </div>
      {(action.description || action.definition || action.comment) && (
        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
          {action.description || action.definition || action.comment}
        </p>
      )}
    </div>
  );
}

function ConstraintDetail({ constraint, constraintsMap }) {
  if (!constraint) return null;
  const looked = lookupInMap(constraint.id, constraintsMap) || {};
  const label = looked.label || constraint.label;
  const description = looked.description || looked.definition || looked.comment || constraint.description;
  const id = constraint.id;
  const expression = constraint.leftOperand
    ? `${constraint.leftOperand} ${constraint.operator || ''} ${Array.isArray(constraint.rightOperand) ? constraint.rightOperand.join(', ') : String(constraint.rightOperand ?? '')}`
    : null;

  return (
    <div className="rounded-md border border-border/40 bg-muted/20 px-2.5 py-2 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        {label && <span className="text-xs font-medium text-foreground">{label}</span>}
        {id && (
          <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 text-primary font-mono text-[10px] px-2 py-0">
            {id}
          </span>
        )}
      </div>
      {description && <p className="text-[11px] text-muted-foreground/70 leading-relaxed">{description}</p>}
      {expression && <p className="text-[10px] font-mono text-muted-foreground/60">{expression}</p>}
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
            <span className="text-muted-foreground text-[10px] uppercase tracking-wider">action</span>
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

const STATUS_COLORS = {
  active:     'bg-accent/15 text-accent border-accent/30',
  deprecated: 'bg-muted text-muted-foreground border-border/40',
  pending:    'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  rejected:   'bg-destructive/15 text-destructive border-destructive/30',
  amendment:  'bg-primary/15 text-primary border-primary/30',
  draft:      'bg-secondary text-secondary-foreground border-border/40',
};

function StatusBadge({ statusId, statesMap }) {
  if (!statusId) return null;
  const shortKey = String(statusId).split(/[:/]/).pop()?.toLowerCase();
  // Try full id, short key, and scan all values for a match on any segment
  const state = statesMap?.[statusId]
    || statesMap?.[shortKey]
    || Object.values(statesMap || {}).find(s => String(s.id || '').split(/[:/]/).pop()?.toLowerCase() === shortKey)
    || { id: statusId, label: shortKey || statusId };
  const label = state.label || state.id;
  const definition = state.definition || '';
  const colorKey = String(state.id || shortKey || '').split(/[:/]/).pop()?.toLowerCase();
  const colorClass = STATUS_COLORS[colorKey] || 'bg-muted text-muted-foreground border-border/40';

  const badge = (
    <span className={`inline-flex items-center rounded-full border text-[10px] px-2 py-0 font-normal cursor-default ${colorClass}`}>
      {label}
    </span>
  );

  if (!definition) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">{definition}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function ComposePolicyCard({ policy, actionsMap, constraintsMap, statesMap, onEdit, onCopy, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Expand toggle */}
        <button
          className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* Title + id */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(e => !e)}>
          <span className="font-medium text-sm text-foreground">{policy.label}</span>
          {(policy.odrl_type || policy.status) && (
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              {policy.odrl_type && (
                <Badge className="text-[10px] px-1.5 py-0 bg-primary/15 text-primary border-primary/30 font-normal">
                  {policy.odrl_type}
                </Badge>
              )}
              {policy.status && (
                <StatusBadge statusId={policy.status} statesMap={statesMap} />
              )}
            </div>
          )}
          <div className="font-mono text-[11px] text-muted-foreground mt-0.5 truncate">{policy.id}</div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Edit policy"
            onClick={() => setEditing(true)}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Copy policy"
            onClick={() => onCopy?.(policy)}
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            title="Delete policy"
            onClick={() => onDelete?.(policy)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border/40 bg-muted/10">
          <RuleSection icon={ShieldCheck} label="Permissions"  color="text-accent"      items={policy.permissions}  actionsMap={actionsMap} constraintsMap={constraintsMap} />
          <RuleSection icon={ShieldOff}  label="Prohibitions" color="text-destructive" items={policy.prohibitions} actionsMap={actionsMap} constraintsMap={constraintsMap} />
          <RuleSection icon={Gavel}      label="Duties"       color="text-yellow-400"  items={policy.duties}       actionsMap={actionsMap} constraintsMap={constraintsMap} />
        </div>
      )}

      {editing && (
        <PolicyEditor
          policy={policy}
          actionsMap={actionsMap}
          onSave={(updated) => onEdit?.(updated)}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}