import React from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Pencil, Trash2, RefreshCw } from 'lucide-react';
import useRefreshSource from '@/hooks/useRefreshSource';
import {
  STRATEGY_LABELS,
  STATUS_DOT,
  STATUS_LABELS,
  lastRefreshLabel,
  statusOf,
} from './refreshFormat';

function Chips({ label, values }) {
  if (!values || values.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-[11px] text-muted-foreground mr-1">{label}</span>
      {values.map(v => (
        <Badge key={v} variant="outline" className="text-[10px] font-normal py-0">{v}</Badge>
      ))}
    </div>
  );
}

export default function RefreshSourceCard({ source, onEdit }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const refresh = useRefreshSource();

  const deleteSource = useMutation({
    mutationFn: () => base44.entities.RefreshSource.delete(source.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refreshSources'] });
      toast({ title: 'Source removed', description: `"${source.name}" is no longer tracked.` });
    },
    onError: (error) => {
      toast({ title: 'Could not remove source', description: error.message, variant: 'destructive' });
    },
  });

  const status = statusOf(source);
  const isAutomated = source.refresh_handler === 'mirror_upstream';
  const isRefreshing = refresh.isPending && refresh.variables?.id === source.id;

  return (
    <Card className="bg-card border-border/50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm truncate">{source.name}</span>
              <Badge variant="secondary" className="text-[10px] font-normal">{source.category}</Badge>
              {source.is_active === false && (
                <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">Hidden</Badge>
              )}
            </div>
            {source.description && (
              <p className="text-xs text-muted-foreground mt-1">{source.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(source)} title="Edit">
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => {
                if (window.confirm(`Stop tracking "${source.name}"?`)) deleteSource.mutate();
              }}
              disabled={deleteSource.isPending}
              title="Remove"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="space-y-1 text-xs">
          {source.upstream_source && (
            <div className="flex gap-1.5">
              <span className="text-muted-foreground shrink-0">Upstream</span>
              <span className="font-mono break-all">{source.upstream_source}</span>
            </div>
          )}
          {source.cache_path && (
            <div className="flex gap-1.5">
              <span className="text-muted-foreground shrink-0">Cache</span>
              <span className="font-mono break-all">{source.cache_path}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] font-normal">{STRATEGY_LABELS[source.refresh_strategy] || source.refresh_strategy}</Badge>
          {source.schedule_note && (
            <span className="text-[11px] text-muted-foreground">{source.schedule_note}</span>
          )}
        </div>

        <Chips label="Depends on" values={source.depends_on} />
        <Chips label="Read by" values={source.consumers} />

        {source.notes && (
          <p className="text-[11px] text-muted-foreground border-l-2 border-border/60 pl-2">{source.notes}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/30">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
            <span>{STATUS_LABELS[status]}</span>
            {source.last_refresh_at && <span>· {lastRefreshLabel(source)}</span>}
            {status === 'failed' && source.last_refresh_message && (
              <span className="text-destructive">· {source.last_refresh_message}</span>
            )}
          </div>
          {isAutomated ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-7 text-xs"
              onClick={() => refresh.mutate(source)}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          ) : (
            <span className="text-[11px] text-muted-foreground">No automated refresh</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}