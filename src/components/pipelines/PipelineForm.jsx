import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const SCHEDULES = ['manual', 'every_5min', 'every_15min', 'hourly', 'daily', 'weekly'];

export default function PipelineForm({ open, onClose, onSubmit, initialData }) {
  const [form, setForm] = useState(initialData || {
    name: '',
    description: '',
    schedule: 'manual',
    namespace: 'openrel',
    status: 'draft',
  });

  useEffect(() => {
    setForm(initialData || { name: '', description: '', schedule: 'manual', namespace: 'openrel', status: 'draft' });
  }, [initialData?.id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Pipeline' : 'New Pipeline'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label className="text-xs">Name</Label>
            <Input
              value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder="e.g. users-sync-prod"
              className="font-mono text-sm bg-muted/50"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={form.description || ''}
              onChange={e => update('description', e.target.value)}
              placeholder="What does this pipeline do?"
              className="text-sm bg-muted/50 h-20"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Schedule</Label>
            <Select value={form.schedule || 'manual'} onValueChange={v => update('schedule', v)}>
              <SelectTrigger className="bg-muted/50 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULES.map(s => (
                  <SelectItem key={s} value={s} className="text-sm">{s.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            After creating, configure the source file, template, mapping, and GitHub target in the pipeline detail view.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90">
              {initialData ? 'Save Changes' : 'Create Pipeline'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}