import React, { useState } from 'react';
import { WORKFLOW_TYPES } from './WorkflowCard';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

export default function WorkflowNewDialog({ open, onClose, onCreate }) {
  const [selectedType, setSelectedType] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleClose = () => {
    setSelectedType(null);
    setName('');
    setDescription('');
    onClose();
  };

  const handleCreate = () => {
    if (!selectedType || !name.trim()) return;
    onCreate({ workflow_type: selectedType, name: name.trim(), description: description.trim() });
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Workflow</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Type selector */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select Workflow Type</p>
            <div className="grid gap-3">
              {Object.values(WORKFLOW_TYPES).map(wt => {
                const Icon = wt.icon;
                const selected = selectedType === wt.id;
                return (
                  <button
                    key={wt.id}
                    onClick={() => setSelectedType(wt.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-4 text-left transition-all",
                      selected
                        ? "border-primary/60 bg-primary/5"
                        : "border-border/50 hover:border-border hover:bg-muted/30"
                    )}
                  >
                    <div className={cn('p-2 rounded-md shrink-0', wt.bg)}>
                      <Icon className={cn('w-4 h-4', wt.color)} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{wt.label}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{wt.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {wt.steps.map((s, i) => (
                          <span key={s.id} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {i + 1}. {s.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 transition-all",
                      selected ? "border-primary bg-primary" : "border-border"
                    )} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name + description — only show once type is selected */}
          {selectedType && (
            <div className="space-y-3 pt-1 border-t border-border/40">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Dataset Licence Review Q2"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Description (optional)</label>
                <Input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Brief description..."
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!selectedType || !name.trim()}>
            Create Workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}