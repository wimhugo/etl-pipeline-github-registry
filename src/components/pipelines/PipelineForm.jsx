import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const SOURCE_TYPES = ['postgresql', 'mysql', 'mongodb', 's3', 'api', 'csv', 'kafka', 'redis'];
const DEST_TYPES = ['postgresql', 'mysql', 'mongodb', 's3', 'bigquery', 'snowflake', 'elasticsearch', 'redis'];
const SCHEDULES = ['manual', 'every_5min', 'every_15min', 'hourly', 'daily', 'weekly'];

export default function PipelineForm({ open, onClose, onSubmit, initialData }) {
  const [form, setForm] = useState(initialData || {
    name: '',
    description: '',
    source_type: 'postgresql',
    destination_type: 'bigquery',
    schedule: 'manual',
    transform_logic: '',
    namespace: 'openrel',
  });

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
              value={form.description}
              onChange={e => update('description', e.target.value)}
              placeholder="What does this pipeline do?"
              className="text-sm bg-muted/50 h-20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Source</Label>
              <Select value={form.source_type} onValueChange={v => update('source_type', v)}>
                <SelectTrigger className="bg-muted/50 font-mono text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map(t => (
                    <SelectItem key={t} value={t} className="font-mono text-sm">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Destination</Label>
              <Select value={form.destination_type} onValueChange={v => update('destination_type', v)}>
                <SelectTrigger className="bg-muted/50 font-mono text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEST_TYPES.map(t => (
                    <SelectItem key={t} value={t} className="font-mono text-sm">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Schedule</Label>
            <Select value={form.schedule} onValueChange={v => update('schedule', v)}>
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

          <div className="space-y-2">
            <Label className="text-xs">Transform Logic</Label>
            <Textarea
              value={form.transform_logic}
              onChange={e => update('transform_logic', e.target.value)}
              placeholder="SQL query, transformation script, or mapping rules..."
              className="font-mono text-xs bg-muted/50 h-24"
            />
          </div>

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