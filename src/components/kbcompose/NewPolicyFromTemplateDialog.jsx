import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronRight, ShieldCheck, ShieldOff, Gavel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function RuleSummary({ items, label, color }) {
  if (!items?.length) return null;
  return (
    <span className={`text-[10px] ${color}`}>
      {items.length} {label.toLowerCase()}
    </span>
  );
}

function TemplateCard({ policy, selected, onSelect }) {
  const [expanded, setExpanded] = useState(false);

  // Count placeholder values in the template
  const allText = JSON.stringify(policy);
  const placeholderCount = (allText.match(/<[^>]+>/g) || []).length;

  return (
    <div
      className={cn(
        'rounded-lg border transition-all cursor-pointer',
        selected
          ? 'border-primary/60 bg-primary/5'
          : 'border-border/50 hover:border-border hover:bg-muted/20'
      )}
      onClick={() => onSelect(policy)}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Radio dot */}
        <div className={cn(
          'w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 transition-all',
          selected ? 'border-primary bg-primary' : 'border-border'
        )} />

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground">{policy.label}</p>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            {policy.odrl_type && (
              <Badge className="text-[10px] px-1.5 py-0 bg-primary/15 text-primary border-primary/30 font-normal">
                {policy.odrl_type}
              </Badge>
            )}
            <RuleSummary items={policy.permissions}  label="Permissions"  color="text-accent" />
            <RuleSummary items={policy.prohibitions} label="Prohibitions" color="text-destructive" />
            <RuleSummary items={policy.duties}       label="Duties"       color="text-yellow-400" />
            {placeholderCount > 0 && (
              <span className="text-[10px] text-muted-foreground italic">{placeholderCount} placeholder{placeholderCount > 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground mt-0.5 truncate">{policy.id}</div>
        </div>

        <button
          className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
          onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}
          title="Preview template structure"
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-3 border-t border-border/30 bg-muted/10">
          <pre className="text-[10px] text-muted-foreground font-mono whitespace-pre-wrap mt-2 max-h-48 overflow-y-auto leading-relaxed">
            {JSON.stringify(policy, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function NewPolicyFromTemplateDialog({ open, onClose, templates, onCreate }) {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');

  const handleClose = () => {
    setSelected(null);
    setSearch('');
    setNewName('');
    onClose();
  };

  const handleCreate = () => {
    if (!selected) return;
    const label = newName.trim() || `${selected.label} (draft)`;
    const newId = `${selected.id}-draft-${Date.now()}`;
    const draft = {
      ...selected,
      id: newId,
      label,
      status: 'openrel:status/draft',
      derived_from: selected.id,
      _createdLocally: Date.now(),
    };
    onCreate(draft);
    handleClose();
  };

  const filtered = templates.filter(t => {
    const q = search.toLowerCase();
    return !q || (t.label || '').toLowerCase().includes(q) || (t.id || '').toLowerCase().includes(q);
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            New Policy from Template
          </DialogTitle>
          <p className="text-xs text-muted-foreground pt-0.5">
            Select a template to base your new policy on. It will be saved locally as a draft.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-1 min-h-0">
          {/* Step 1: Select template */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Step 1 — Select Template
            </p>
            <Input
              placeholder="Search templates…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 text-xs bg-muted/40"
            />
            {templates.length === 0 && (
              <div className="text-xs text-muted-foreground italic py-4 text-center">
                No templates found. Policies with status <code className="font-mono">openrel:status/template</code> will appear here.
              </div>
            )}
            {templates.length > 0 && filtered.length === 0 && (
              <div className="text-xs text-muted-foreground italic py-2 text-center">No templates match your search.</div>
            )}
            <div className="space-y-2">
              {filtered.map(t => (
                <TemplateCard
                  key={t.id}
                  policy={t}
                  selected={selected?.id === t.id}
                  onSelect={setSelected}
                />
              ))}
            </div>
          </div>

          {/* Step 2: Name the new policy */}
          {selected && (
            <div className="space-y-2 border-t border-border/40 pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Step 2 — Name Your New Policy
              </p>
              <Input
                placeholder={`${selected.label} (draft)`}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="h-8 text-xs"
                autoFocus
              />
              <p className="text-[10px] text-muted-foreground">
                Leave blank to use default name. The draft will appear at the top of the policy list.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2 border-t border-border/40">
          <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
          <Button size="sm" onClick={handleCreate} disabled={!selected}>
            Create Draft Policy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}