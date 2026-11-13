import React from 'react';
import { cn } from '@/lib/utils';

function shortPath(endpoint, basePath) {
  const full = '/' + String(endpoint.path || '').replace(/^\/+/, '');
  if (basePath && full.startsWith(basePath)) return full.slice(basePath.length) || '/';
  return full;
}

export default function ApiEndpointRow({ endpoint, basePath }) {
  const isDetail = endpoint.endpoint_type === 'detail';
  const isGet = (endpoint.method || 'GET') === 'GET';

  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-border/40 last:border-0">
      <span
        className={cn(
          'mt-0.5 inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide shrink-0',
          isGet ? 'bg-primary/15 text-primary' : 'bg-accent/15 text-accent'
        )}
      >
        {endpoint.method || 'GET'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11.5px] text-foreground break-all leading-snug">
          {shortPath(endpoint, basePath)}
        </p>
        <p className="text-[11px] text-muted-foreground leading-snug truncate">
          {endpoint.section}
          {isDetail ? ' · single member' : ' · list'}
        </p>
      </div>
    </div>
  );
}