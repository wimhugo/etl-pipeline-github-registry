import React from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, RefreshCw, Settings2 } from 'lucide-react';
import RefreshTaskCard from '@/components/refresh/RefreshTaskCard';

export default function Dashboard() {
  const { data: sources = [], isLoading } = useQuery({
    queryKey: ['refreshSources'],
    queryFn: async () => {
      const page = await base44.entities.RefreshSource.list({ sort: 'name', limit: 100 });
      return page.items || [];
    },
  });

  const tasks = sources.filter(s => s.is_active !== false);
  const runnable = tasks.filter(t => t.refresh_handler === 'mirror_upstream');
  const failing = tasks.filter(t => t.last_refresh_status === 'failed');

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">OpenREL 0.4 — KB Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Refresh tasks for the sources the knowledge base reads. Automated tasks mirror an upstream document into
            the repository copy; generated sources record what they depend on.
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">
            {tasks.length} source{tasks.length === 1 ? '' : 's'} tracked · {runnable.length} refreshable here
            {failing.length > 0 && <span className="text-destructive"> · {failing.length} failing</span>}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link to="/v0.4/source-registry">
            <Settings2 className="w-3.5 h-3.5" />
            Manage sources
          </Link>
        </Button>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh tasks
        </h2>

        {isLoading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading tasks…
          </div>
        ) : tasks.length === 0 ? (
          <Card className="bg-card border-border/50">
            <CardContent className="py-10 text-center space-y-3">
              <p className="text-sm font-medium">No sources tracked yet</p>
              <p className="text-xs text-muted-foreground">
                Define the sources and their refresh strategy in the source registry.
              </p>
              <Button size="sm" asChild className="gap-1.5">
                <Link to="/v0.4/source-registry">
                  <Settings2 className="w-3.5 h-3.5" />
                  Open source registry
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {tasks.map(task => (
              <RefreshTaskCard key={task.id} source={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}