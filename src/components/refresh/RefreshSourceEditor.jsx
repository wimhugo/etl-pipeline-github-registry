import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

const EMPTY = {
  name: '',
  description: '',
  category: 'Vocabulary',
  upstream_source: '',
  cache_path: '',
  refresh_handler: 'none',
  refresh_strategy: 'on_demand',
  schedule_note: '',
  depends_on: '',
  consumers: '',
  notes: '',
  is_active: true,
};

const CATEGORIES = ['Vocabulary', 'Schema', 'Registry', 'Mapping', 'Index', 'Other'];

const HANDLERS = [
  { value: 'mirror_upstream', label: 'Mirror upstream → cache path' },
  { value: 'none', label: 'No automated refresh (tracked only)' },
];

const STRATEGIES = [
  { value: 'on_demand', label: 'On demand' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'on_dependency_change', label: 'When a dependency changes' },
  { value: 'manual', label: 'Manual — outside the platform' },
];

const toList = (value) => String(value || '').split(',').map(v => v.trim()).filter(Boolean);

export default function RefreshSourceEditor({ open, onOpenChange, source }) {
  const [form, setForm] = useState(EMPTY);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setForm(source ? {
      name: source.name || '',
      description: source.description || '',
      category: source.category || 'Vocabulary',
      upstream_source: source.upstream_source || '',
      cache_path: source.cache_path || '',
      refresh_handler: source.refresh_handler || 'none',
      refresh_strategy: source.refresh_strategy || 'on_demand',
      schedule_note: source.schedule_note || '',
      depends_on: (source.depends_on || []).join(', '),
      consumers: (source.consumers || []).join(', '),
      notes: source.notes || '',
      is_active: source.is_active !== false,
    } : { ...EMPTY });
  }, [open, source?.id]);

  const save = useMutation({
    mutationFn: (payload) => (
      source
        ? base44.entities.RefreshSource.update(source.id, payload)
        : base44.entities.RefreshSource.create(payload)
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refreshSources'] });
      toast({ title: source ? 'Source updated' : 'Source added' });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({ title: 'Could not save source', description: error.message, variant: 'destructive' });
    },
  });

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const needsMirrorDetails = form.refresh_handler === 'mirror_upstream';
  const canSave = form.name.trim().length > 0
    && (!needsMirrorDetails || (form.upstream_source.trim() && form.cache_path.trim()));

  const handleSave = () => {
    if (!canSave) return;
    save.mutate({
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      upstream_source: form.upstream_source.trim(),
      cache_path: form.cache_path.trim(),
      refresh_handler: form.refresh_handler,
      refresh_strategy: form.refresh_strategy,
      schedule_note: form.schedule_note.trim(),
      depends_on: toList(form.depends_on),
      consumers: toList(form.consumers),
      notes: form.notes.trim(),
      is_active: form.is_active,
    });
  };

  const textField = (key, label, placeholder, mono = false) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        className={mono ? 'bg-muted/50 text-sm font-mono' : 'bg-muted/50 text-sm'}
        placeholder={placeholder}
        value={form[key]}
        onChange={e => set(key, e.target.value)}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{source ? `Edit ${source.name}` : 'Add source'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {textField('name', 'Name', 'ODRL 2.2 vocabulary cache')}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Select value={form.category} onValueChange={(value) => set('category', value)}>
                <SelectTrigger className="bg-muted/50 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea
              className="bg-muted/50 text-sm h-16"
              placeholder="What this source holds and which features read it"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {textField('upstream_source', 'Upstream source', 'https://… or the path it is derived from', true)}
            {textField('cache_path', 'Cache path in repository', 'model/vocabs/odrl/odrl.ttl', true)}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Refresh handler</Label>
              <Select value={form.refresh_handler} onValueChange={(value) => set('refresh_handler', value)}>
                <SelectTrigger className="bg-muted/50 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HANDLERS.map(h => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Refresh strategy</Label>
              <Select value={form.refresh_strategy} onValueChange={(value) => set('refresh_strategy', value)}>
                <SelectTrigger className="bg-muted/50 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STRATEGIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {needsMirrorDetails && (
            <p className="text-xs text-muted-foreground">
              Automated refresh fetches the upstream source and commits it to the cache path when the content changed.
            </p>
          )}

          {textField('schedule_note', 'Schedule or trigger', 'weekly · after a vocabulary release · when a profile changes')}

          <div className="grid gap-3 sm:grid-cols-2">
            {textField('depends_on', 'Depends on (comma separated)', 'ODRL 2.2 vocabulary cache')}
            {textField('consumers', 'Read by (comma separated)', 'ODRL Classes, ODRL Individuals')}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea
              className="bg-muted/50 text-sm h-16"
              placeholder="Refresh requirements, caveats, where the automated part runs…"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2.5">
            <Switch checked={form.is_active} onCheckedChange={(value) => set('is_active', value)} />
            <span className="text-sm text-muted-foreground">Show this source on the dashboard</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save source'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}