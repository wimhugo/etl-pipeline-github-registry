import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ApiSourceFileEditor({ open, onClose, onSave, sourceFile }) {
  const [form, setForm] = useState({});

  useEffect(() => {
    setForm(sourceFile
      ? { ...sourceFile }
      : { data_format: 'ttl', is_active: true, sort_order: 0, member_identifier: 'skos:Concept' });
  }, [sourceFile, open]);

  const handleSave = () => {
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{sourceFile ? 'Edit API Source File' : 'Add API Source File'}</DialogTitle>
          <DialogDescription>
            Define an API section and point it to a GitHub source file.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">API Section</Label>
            <Input
              className="bg-muted/50 text-sm font-mono"
              placeholder="e.g. Actions"
              value={form.section || ''}
              onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea
              className="bg-muted/50 text-sm h-16"
              placeholder="What this API section provides…"
              value={form.description || ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">GitHub File Path</Label>
            <Input
              className="bg-muted/50 text-sm font-mono"
              placeholder=".openrel/vocabs/openrel/actions.ttl"
              value={form.file_path || ''}
              onChange={e => setForm(f => ({ ...f, file_path: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Member Instance Identifier</Label>
            <Input
              className="bg-muted/50 text-sm font-mono"
              placeholder="skos:Concept"
              value={form.member_identifier || ''}
              onChange={e => setForm(f => ({ ...f, member_identifier: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              How members are recognized in the file — 'skos:Concept' for concept schemes, or a class IRI for instance lists.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs text-muted-foreground">Data Format</Label>
              <Select
                value={form.data_format || 'ttl'}
                onValueChange={(val) => setForm(f => ({ ...f, data_format: val }))}
              >
                <SelectTrigger className="bg-muted/50 text-sm font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['ttl', 'json', 'json-ld', 'yaml'].map(fmt => (
                    <SelectItem key={fmt} value={fmt}>{fmt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 w-24">
              <Label className="text-xs text-muted-foreground">Order</Label>
              <Input
                type="number"
                className="bg-muted/50 text-sm font-mono"
                value={form.sort_order ?? 0}
                onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.section?.trim() || !form.file_path?.trim()}>
            {sourceFile ? 'Update' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}