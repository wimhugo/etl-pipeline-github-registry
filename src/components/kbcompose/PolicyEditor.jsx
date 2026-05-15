import React, { useState } from 'react';
import { ShieldCheck, ShieldOff, Gavel, Plus, Trash2, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * PolicyEditor dialog – edit/add/delete actions and their constraints per rule section.
 * Props:
 *   policy         – the policy object to edit
 *   actionsMap     – { [id]: action }
 *   constraintsMap – { [id]: constraint }
 *   onSave(updatedPolicy) – called with the modified policy (status forced to draft)
 *   onClose()
 */

const RULE_SECTIONS = [
  { key: 'permissions',  label: 'Permissions',  icon: ShieldCheck, color: 'text-accent' },
  { key: 'prohibitions', label: 'Prohibitions', icon: ShieldOff,   color: 'text-destructive' },
  { key: 'duties',       label: 'Duties',       icon: Gavel,       color: 'text-yellow-400' },
];

function normalizeId(id) {
  return String(id || '').replace(/[.\-]/g, ':').toLowerCase();
}

function lookupInMap(id, map) {
  if (!map || !id) return null;
  if (map[id]) return map[id];
  const normId = normalizeId(id);
  return Object.values(map).find(v => normalizeId(v.id) === normId) || null;
}

function ActionChip({ actionId, actionsMap }) {
  const action = lookupInMap(actionId, actionsMap);
  if (!action) return <span className="font-mono text-[11px] text-muted-foreground">{actionId}</span>;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs font-medium text-foreground">{action.label}</span>
      <span className="font-mono text-[10px] rounded-full border border-primary/40 bg-primary/10 text-primary px-2 py-0">
        {action.id}
      </span>
      {action.odrl_mapping && (
        <span className="font-mono text-[10px] rounded-full border border-accent/40 bg-accent/10 text-accent px-2 py-0 flex items-center gap-1">
          <ExternalLink className="w-2.5 h-2.5" />{action.odrl_mapping}
        </span>
      )}
    </div>
  );
}

function ConstraintRow({ constraintId, constraintsMap, onRemove }) {
  const c = lookupInMap(constraintId, constraintsMap);
  const label = c?.label || constraintId;
  const id = c?.id || constraintId;
  return (
    <div className="flex items-center gap-2 rounded border border-border/40 bg-muted/20 px-2 py-1.5">
      <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-foreground">{label}</span>
        <span className="font-mono text-[10px] rounded-full border border-primary/40 bg-primary/10 text-primary px-1.5 py-0 truncate">
          {id}
        </span>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
        title="Remove constraint"
      >
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
}

function ActionEditor({ item, idx, actionsMap, constraintsMap, onItemChange, onDelete }) {
  const actionIds = Object.keys(actionsMap);
  const constraintIds = Object.keys(constraintsMap);

  // Normalise: constraint can be a single object {id,…} or an array of such
  const existingConstraints = item.constraint
    ? (Array.isArray(item.constraint) ? item.constraint : [item.constraint])
    : [];

  const handleActionChange = (newActionId) => {
    onItemChange(idx, { ...item, action: newActionId });
  };

  const handleAddConstraint = (cid) => {
    if (!cid) return;
    const already = existingConstraints.some(c => c.id === cid);
    if (already) return;
    const newList = [...existingConstraints, { id: cid }];
    onItemChange(idx, { ...item, constraint: newList.length === 1 ? newList[0] : newList });
  };

  const handleRemoveConstraint = (cid) => {
    const newList = existingConstraints.filter(c => c.id !== cid);
    const next = newList.length === 0 ? undefined : newList.length === 1 ? newList[0] : newList;
    const updated = { ...item };
    if (next === undefined) delete updated.constraint;
    else updated.constraint = next;
    onItemChange(idx, updated);
  };

  return (
    <div className="rounded-md border border-border/40 bg-muted/20 px-2.5 py-2 space-y-2">
      {/* Action row */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0 space-y-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Action</span>
          <ActionChip actionId={item.action} actionsMap={actionsMap} />
          <Select value={item.action || ''} onValueChange={handleActionChange}>
            <SelectTrigger className="h-7 text-xs bg-muted/30 border-border/50">
              <SelectValue placeholder="Select action…" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {actionIds.map(aid => {
                const a = actionsMap[aid];
                return (
                  <SelectItem key={aid} value={aid} className="text-xs">
                    {a?.label || aid}
                    {a?.id && <span className="ml-1.5 text-muted-foreground font-mono text-[10px]">({a.id})</span>}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive mt-5"
          title="Remove action"
          onClick={() => onDelete(idx)}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {/* Constraints sub-section */}
      <div className="pl-3 border-l-2 border-border/40 space-y-1.5">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Constraints</span>
        {existingConstraints.length === 0 && (
          <p className="text-[11px] text-muted-foreground italic">No constraints.</p>
        )}
        {existingConstraints.map((c, ci) => (
          <ConstraintRow
            key={ci}
            constraintId={c.id}
            constraintsMap={constraintsMap}
            onRemove={() => handleRemoveConstraint(c.id)}
          />
        ))}
        {/* Add constraint selector */}
        {constraintIds.length > 0 && (
          <Select value="" onValueChange={handleAddConstraint}>
            <SelectTrigger className="h-7 text-xs bg-muted/30 border-border/50 border-dashed">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Plus className="w-3 h-3" /> Add constraint…
              </span>
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {constraintIds
                .filter(cid => !existingConstraints.some(c => c.id === cid))
                .map(cid => {
                  const c = constraintsMap[cid];
                  return (
                    <SelectItem key={cid} value={cid} className="text-xs">
                      {c?.label || cid}
                      {c?.id && <span className="ml-1.5 text-muted-foreground font-mono text-[10px]">({c.id})</span>}
                    </SelectItem>
                  );
                })}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

function RuleSectionEditor({ sectionKey, label, icon: Icon, color, items, actionsMap, constraintsMap, onChange }) {
  const actionIds = Object.keys(actionsMap);

  const handleItemChange = (idx, updatedItem) => {
    onChange(sectionKey, items.map((it, i) => i === idx ? updatedItem : it));
  };

  const handleDelete = (idx) => {
    onChange(sectionKey, items.filter((_, i) => i !== idx));
  };

  const handleAdd = () => {
    onChange(sectionKey, [...items, { action: actionIds[0] || '' }]);
  };

  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${color}`}>
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>

      <div className="space-y-2 pl-2 border-l border-border/50">
        {items.length === 0 && (
          <p className="text-[11px] text-muted-foreground italic">No {label.toLowerCase()} defined.</p>
        )}
        {items.map((item, idx) => (
          <ActionEditor
            key={idx}
            item={item}
            idx={idx}
            actionsMap={actionsMap}
            constraintsMap={constraintsMap}
            onItemChange={handleItemChange}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1.5 ml-2"
        onClick={handleAdd}
        disabled={actionIds.length === 0}
      >
        <Plus className="w-3.5 h-3.5" /> Add action
      </Button>
    </div>
  );
}

export default function PolicyEditor({ policy, actionsMap, constraintsMap, onSave, onClose }) {
  const [draft, setDraft] = useState(() => ({
    ...policy,
    permissions:  [...(policy.permissions  || [])],
    prohibitions: [...(policy.prohibitions || [])],
    duties:       [...(policy.duties       || [])],
  }));

  const handleSectionChange = (sectionKey, newItems) => {
    setDraft(prev => ({ ...prev, [sectionKey]: newItems }));
  };

  const handleSave = () => {
    onSave({ ...draft, status: 'openrel:status/draft' });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Edit Policy
            <Badge className="ml-2 text-[10px] px-1.5 py-0 bg-secondary text-secondary-foreground border-border/40 font-normal align-middle">
              draft on save
            </Badge>
          </DialogTitle>
          <div className="text-xs text-muted-foreground font-mono truncate pt-0.5">{policy.id}</div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {RULE_SECTIONS.map(({ key, label, icon, color }) => (
            <RuleSectionEditor
              key={key}
              sectionKey={key}
              label={label}
              icon={icon}
              color={color}
              items={draft[key] || []}
              actionsMap={actionsMap}
              constraintsMap={constraintsMap}
              onChange={handleSectionChange}
            />
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="w-3.5 h-3.5 mr-1" /> Cancel
          </Button>
          <Button size="sm" onClick={handleSave}>
            Save as Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}