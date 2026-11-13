import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Loader2, RefreshCw } from 'lucide-react';
import RefreshSourceCard from '@/components/refresh/RefreshSourceCard';
import RefreshSourceEditor from '@/components/refresh/RefreshSourceEditor';

export default function SourceRegistry() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ['refreshSources'],
    queryFn: async () => {
      const page = await base44.entities.RefreshSource.list({ sort: 'name', limit: 100 });
      return page.items || [];
    },
  });

  const openEditor = (source = null) => {
    setEditing(source);
    setOpen(true);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Source registry</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every source the platform reads, where its authoritative copy lives, how it is refreshed and what depends on it.
          </p>
        </div>
        <Button onClick={() => openEditor(null)} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Add source
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading sources…
        </div>
      ) : sources.length === 0 ? (
        <Card className="bg-card border-border/50">
          <CardContent className="py-10 text-center space-y-3">
            <RefreshCw className="w-6 h-6 mx-auto text-muted-foreground/60" />
            <div>
              <p className="text-sm font-medium">No sources defined yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add the vocabularies, indexes and generated files the API depends on.
              </p>
            </div>
            <Button size="sm" onClick={() => openEditor(null)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Add source
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {sources.map(source => (
            <RefreshSourceCard key={source.id} source={source} onEdit={openEditor} />
          ))}
        </div>
      )}

      <RefreshSourceEditor open={open} onOpenChange={setOpen} source={editing} />
    </div>
  );
}