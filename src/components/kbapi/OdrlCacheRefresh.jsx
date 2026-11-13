import React from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, AlertCircle, MinusCircle } from 'lucide-react';

export const ODRL_CACHE_PATH = 'model/vocabs/odrl/odrl.ttl';

function formatBytes(bytes) {
  if (!bytes) return '—';
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function OdrlCacheRefresh() {
  const queryClient = useQueryClient();

  const refresh = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('refreshOdrlCache', {});
      return res.data;
    },
    onSuccess: (data) => {
      if (data?.status === 'updated') {
        queryClient.invalidateQueries({ queryKey: ['previewApiSourceFile'] });
      }
    },
  });

  const result = refresh.data;
  const errorMessage = refresh.error?.response?.data?.error || refresh.error?.message;

  return (
    <Card className="bg-card border-border/50">
      <CardContent className="py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">ODRL vocabulary cache</span>
            <span className="text-xs text-muted-foreground font-mono truncate">{ODRL_CACHE_PATH}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upstream copy of the W3C ODRL 2.2 vocabulary, read from the W3C ODRL Working Group repository. Refresh on demand to pull the current version.
          </p>
          {result && (
            <p className="text-xs mt-1.5 flex items-center gap-1.5">
              {result.status === 'updated' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                  <span className="text-accent">Cache updated</span>
                  <span className="text-muted-foreground">
                    {formatBytes(result.bytes)} from {result.upstream_url}
                  </span>
                  {result.commit_url && (
                    <a href={result.commit_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      View commit
                    </a>
                  )}
                </>
              ) : (
                <>
                  <MinusCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Cache already current ({formatBytes(result.bytes)})
                  </span>
                </>
              )}
            </p>
          )}
          {refresh.isError && (
            <p className="text-xs mt-1.5 flex items-start gap-1.5 text-destructive">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Refresh failed: {errorMessage || 'Unknown error'}</span>
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 shrink-0"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refresh.isPending ? 'animate-spin' : ''}`} />
          {refresh.isPending ? 'Refreshing…' : 'Refresh cache'}
        </Button>
      </CardContent>
    </Card>
  );
}