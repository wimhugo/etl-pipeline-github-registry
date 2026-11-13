import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';
import useRefreshSource from '@/hooks/useRefreshSource';
import {
  STRATEGY_LABELS,
  STATUS_DOT,
  STATUS_LABELS,
  lastRefreshLabel,
  statusOf,
} from './refreshFormat';

export default function RefreshTaskCard({ source }) {
  const refresh = useRefreshSource();
  const status = statusOf(source);
  const isAutomated = source.refresh_handler === 'mirror_upstream';
  const isRefreshing = refresh.isPending && refresh.variables?.id === source.id;

  return (
    <Card className="bg-card border-border/50">
      <CardContent className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-sm truncate">{source.name}</span>
              <Badge variant="secondary" className="text-[10px] font-normal">{source.category}</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {STRATEGY_LABELS[source.refresh_strategy] || source.refresh_strategy}
              {source.schedule_note ? ` · ${source.schedule_note}` : ''}
            </p>
          </div>
          <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${STATUS_DOT[status]}`} title={STATUS_LABELS[status]} />
        </div>

        {(source.depends_on?.length > 0 || source.consumers?.length > 0) && (
          <div className="space-y-1 text-[11px] text-muted-foreground">
            {source.depends_on?.length > 0 && (
              <p><span className="opacity-70">Depends on</span> {source.depends_on.join(' · ')}</p>
            )}
            {source.consumers?.length > 0 && (
              <p><span className="opacity-70">Read by</span> {source.consumers.join(' · ')}</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] text-muted-foreground">
            {STATUS_LABELS[status]}
            {source.last_refresh_at && <span> · {lastRefreshLabel(source)}</span>}
            {status === 'failed' && source.last_refresh_message && (
              <span className="text-destructive"> · {source.last_refresh_message}</span>
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
            <span className="text-[11px] text-muted-foreground">Refresh outside the app</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}