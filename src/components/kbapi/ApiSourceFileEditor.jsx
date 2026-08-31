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
      : { source_mode: 'file', data_format: 'ttl', is_active: true, sort_order: 0, member_identifier: 'skos:Concept', title_field: 'dct:title', description_field: 'dct:description' });
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
            <Label className="text-xs text-muted-foreground">Source Mode</Label>
            <Select
              value={form.source_mode || 'file'}
              onValueChange={(val) => setForm(f => ({ ...f, source_mode: val }))}
            >
              <SelectTrigger className="bg-muted/50 text-sm font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="file">file — parse members in a single file</SelectItem>
                <SelectItem value="folder">folder — each TTL file is a member</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {form.source_mode === 'folder'
                ? 'Lists all .ttl files in the folder; each file becomes one member listed by ID, title, and description.'
                : 'Parses a single source file and extracts all members matching the identifier below.'}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {form.source_mode === 'folder' ? 'GitHub Folder Path' : 'GitHub File Path'}
            </Label>
            <Input
              className="bg-muted/50 text-sm font-mono"
              placeholder={form.source_mode === 'folder' ? 'data/policy' : '.openrel/vocabs/openrel/actions.ttl'}
              value={form.file_path || ''}
              onChange={e => setForm(f => ({ ...f, file_path: e.target.value }))}
            />
          </div>
          {form.source_mode === 'folder' ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">ID Prefix (optional)</Label>
                <Input
                  className="bg-muted/50 text-sm font-mono"
                  placeholder="openrel:"
                  value={form.id_prefix || ''}
                  onChange={e => setForm(f => ({ ...f, id_prefix: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  When set, the list/detail ID replaces the resolved @base with this prefix (e.g. openrel:01-public-domain). Leave empty to use the full subject IRI.
                </p>
              </div>
              <div className="flex gap-4">
                <div className="space-y-1.5 flex-1">
                  <Label className="text-xs text-muted-foreground">Title Field</Label>
                  <Input
                    className="bg-muted/50 text-sm font-mono"
                    placeholder="dct:title"
                    value={form.title_field || 'dct:title'}
                    onChange={e => setForm(f => ({ ...f, title_field: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5 flex-1">
                  <Label className="text-xs text-muted-foreground">Description Field</Label>
                  <Input
                    className="bg-muted/50 text-sm font-mono"
                    placeholder="dct:description"
                    value={form.description_field || 'dct:description'}
                    onChange={e => setForm(f => ({ ...f, description_field: e.target.value }))}
                  />
                </div>
              </div>
            </>
          ) : (
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
          )}
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