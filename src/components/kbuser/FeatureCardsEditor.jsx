import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KB_USER_FEATURES_DEFAULT, WORKFLOW_TYPES_DEFAULT } from '@/lib/RoleContext';

const ICON_OPTIONS = [
  'FileCheck2', 'Search', 'Microscope', 'BookOpen', 'Zap', 'Lock',
  'Users', 'Layers', 'Settings', 'GitBranch', 'Star', 'ArrowRight',
];

const LINKED_TYPE_OPTIONS = [
  { label: '— None —', value: '__none__' },
  ...WORKFLOW_TYPES_DEFAULT.map(wt => ({
    label: `Workflow: ${wt.label}`,
    value: wt.path,
  })),
  ...KB_USER_FEATURES_DEFAULT.map(f => ({
    label: `Feature: ${f.label}`,
    value: f.path,
  })),
];

const EMPTY_FORM = { title: '', description: '', icon_name: 'Star', target_path: '', linked_type: '', order: 0, is_active: true };

export default function FeatureCardsEditor() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: cards = [] } = useQuery({
    queryKey: ['featureCards'],
    queryFn: () => base44.entities.FeatureCard.list('order'),
  });

  const sorted = [...cards].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.FeatureCard.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['featureCards'] }); closeDialog(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FeatureCard.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['featureCards'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FeatureCard.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['featureCards'] }),
  });

  const openNew = () => {
    setEditingCard(null);
    setForm({ ...EMPTY_FORM, order: (sorted[sorted.length - 1]?.order ?? -1) + 1 });
    setDialogOpen(true);
  };

  const openEdit = (card) => {
    setEditingCard(card);
    setForm({ title: card.title || '', description: card.description || '', icon_name: card.icon_name || 'Star', target_path: card.target_path || '', linked_type: card.linked_type || '', order: card.order ?? 0, is_active: card.is_active !== false });
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditingCard(null); };

  const handleSave = () => {
    if (!form.title.trim()) return;
    if (editingCard) {
      updateMutation.mutate({ id: editingCard.id, data: form });
      closeDialog();
    } else {
      createMutation.mutate(form);
    }
  };

  const handleToggleActive = (card) => {
    updateMutation.mutate({ id: card.id, data: { is_active: card.is_active === false ? true : false } });
  };

  const setField = (key, value) => setForm(f => ({ ...f, [key]: value }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Define "I want to…" quick-start cards shown at the top of the KB User Dashboard. Cards are filtered by role permissions automatically.
        </p>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={openNew}>
          <Plus className="w-3.5 h-3.5" /> Add Card
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 py-8 text-center text-sm text-muted-foreground">
          No cards yet. Click "Add Card" to create the first one.
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(card => (
            <div
              key={card.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5",
                card.is_active === false && "opacity-50"
              )}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{card.title}</p>
                {card.description && (
                  <p className="text-xs text-muted-foreground truncate">{card.description}</p>
                )}
                {card.linked_type && (
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {LINKED_TYPE_OPTIONS.find(o => o.value === card.linked_type)?.label || card.linked_type}
                  </p>
                )}
              </div>
              <Switch
                checked={card.is_active !== false}
                onCheckedChange={() => handleToggleActive(card)}
                className="shrink-0"
              />
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => openEdit(card)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(card.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCard ? 'Edit Card' : 'New Card'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Title *</Label>
              <Input value={form.title} onChange={e => setField('title', e.target.value)} placeholder="e.g. Licence a resource" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Input value={form.description} onChange={e => setField('description', e.target.value)} placeholder="Short description…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Icon</Label>
                <Select value={form.icon_name} onValueChange={v => setField('icon_name', v)}>
                  <SelectTrigger className="bg-muted/50 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Order</Label>
                <Input type="number" value={form.order} onChange={e => setField('order', Number(e.target.value))} className="bg-muted/50" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Navigate to (path)</Label>
              <Input value={form.target_path} onChange={e => setField('target_path', e.target.value)} placeholder="/kb-user/workflow?type=licence" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Permission filter (linked feature/workflow)</Label>
              <Select value={form.linked_type || '__none__'} onValueChange={v => setField('linked_type', v === '__none__' ? '' : v)}>
                <SelectTrigger className="bg-muted/50 text-sm"><SelectValue placeholder="— None (always visible) —" /></SelectTrigger>
                <SelectContent>
                  {LINKED_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Card will only show if the user's role has access to this feature or workflow type.</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setField('is_active', v)} />
              <Label className="text-sm">Active (visible on dashboard)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.title.trim()}>
              {editingCard ? 'Save Changes' : 'Create Card'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}