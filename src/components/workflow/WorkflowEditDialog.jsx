import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { WORKFLOW_TYPES } from './WorkflowCard';

export default function WorkflowEditDialog({ open, instance, onClose, onSave }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (instance) {
      setName(instance.name || '');
      setDescription(instance.description || '');
    }
  }, [instance]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim() });
    onClose();
  };

  const typeMeta = instance ? WORKFLOW_TYPES[instance.workflow_type] : null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Workflow</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {typeMeta && (
            <p className="text-xs text-muted-foreground">
              Type: <span className="font-medium text-foreground">{typeMeta.label}</span>
            </p>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
            <Input value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Description (optional)</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}