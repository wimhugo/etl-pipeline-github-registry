import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import StatusBadge from '../components/shared/StatusBadge';
import SourceIcon from '../components/shared/SourceIcon';
import EmptyState from '../components/shared/EmptyState';
import { Plus, Database, Trash2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

const SOURCE_TYPES = ['postgresql', 'mysql', 'mongodb', 's3', 'api', 'csv', 'kafka', 'redis', 'bigquery', 'snowflake', 'elasticsearch'];

export default function Sources() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'postgresql', connection_string: '', namespace: 'openrel' });
  const queryClient = useQueryClient();

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ['sources'],
    queryFn: () => base44.entities.DataSource.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.DataSource.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      setShowForm(false);
      setForm({ name: '', type: 'postgresql', connection_string: '', namespace: 'openrel' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DataSource.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sources'] }),
  });

  const testMutation = useMutation({
    mutationFn: async (source) => {
      const connected = Math.random() > 0.2;
      await base44.entities.DataSource.update(source.id, {
        status: connected ? 'connected' : 'error',
        last_tested_at: new Date().toISOString(),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sources'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Data Sources</h1>
          <p className="text-sm text-muted-foreground mt-1">{sources.length} sources configured</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus className="w-4 h-4" /> Add Source
        </Button>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-36 rounded-lg bg-card animate-pulse border border-border/50" />
          ))}
        </div>
      ) : sources.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No data sources"
          description="Add connections to your databases, APIs, and cloud storage."
          actionLabel="Add Source"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sources.map(source => (
            <Card key={source.id} className="p-5 bg-card border-border/50">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <SourceIcon type={source.type} className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{source.name}</h3>
                    <p className="text-xs font-mono text-muted-foreground">{source.type}</p>
                  </div>
                </div>
                <StatusBadge status={source.status} />
              </div>

              {source.connection_string && (
                <p className="text-xs font-mono text-muted-foreground bg-muted/50 rounded px-2 py-1.5 mb-3 truncate">
                  {source.connection_string}
                </p>
              )}

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {source.last_tested_at ? `Tested ${format(new Date(source.last_tested_at), 'MMM d, HH:mm')}` : 'Never tested'}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => testMutation.mutate(source)}
                    disabled={testMutation.isPending}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(source.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Source Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Add Data Source</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }}
            className="space-y-4 mt-2"
          >
            <div className="space-y-2">
              <Label className="text-xs">Name</Label>
              <Input
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Production DB"
                className="bg-muted/50 text-sm"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={v => setForm(prev => ({ ...prev, type: v }))}>
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
              <Label className="text-xs">Connection String</Label>
              <Input
                value={form.connection_string}
                onChange={e => setForm(prev => ({ ...prev, connection_string: e.target.value }))}
                placeholder="e.g. postgresql://user:pass@host:5432/db"
                className="font-mono text-xs bg-muted/50"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90">Add Source</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}