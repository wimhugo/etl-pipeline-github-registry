import React from 'react';
import { Loader2, AlertCircle, FileJson, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const DETAIL_ROUTES = {
  policies: '/kb-user/detail/policies',
};

export default function KBEntityCard({ hint, meta, data, isLoading, isError, filename, fileMeta, count, extras = [] }) {
  const Icon = meta?.icon || FileJson;
  const color = meta?.color || 'text-foreground';
  const bg = meta?.bg || 'bg-muted/20';
  const border = meta?.border || 'border-border/40';

  // Last updated from GitHub file metadata (sha/size always present, but no date — use size as proxy indicator)
  const lastUpdated = fileMeta?.last_modified || null;

  return (
    <div className={`rounded-xl border ${border} bg-card overflow-hidden`}>
      {/* Top accent strip */}
      <div className={`h-1 w-full ${bg.replace('/10', '/40')}`} />

      <div className="px-4 py-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2 ${color}`}>
            <div className={`p-1.5 rounded-lg ${bg}`}>
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold text-foreground">{meta?.label}</span>
          </div>
          {filename && (
            <span className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-[120px]" title={filename}>
              {filename}
            </span>
          )}
        </div>

        {/* Count */}
        <div className="flex items-end gap-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Loading…</span>
            </div>
          ) : isError ? (
            <div className="flex items-center gap-1.5 text-destructive text-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              {filename ? 'Failed to load' : 'Not configured'}
            </div>
          ) : !filename ? (
            <span className="text-xs text-muted-foreground/50 italic">Not configured</span>
          ) : (
            <>
              <span className={`text-4xl font-bold tabular-nums leading-none ${color}`}>
                {count ?? '—'}
              </span>
              <span className="text-xs text-muted-foreground mb-1">
                {hint === 'scenarios' ? 'scenarios' : (meta?.label?.toLowerCase() || 'items')}
              </span>
            </>
          )}
        </div>

        {/* Extra stats */}
        {!isLoading && !isError && extras.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-1 border-t border-border/30">
            {extras.map(e => (
              <div key={e.label} className="flex flex-col">
                <span className="text-lg font-semibold tabular-nums text-foreground/80 leading-none">{e.value}</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">{e.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Detail link */}
        {DETAIL_ROUTES[hint] && !isLoading && !isError && count !== null && (
          <Link
            to={DETAIL_ROUTES[hint]}
            className={`inline-flex items-center gap-1 text-[11px] ${meta?.color || 'text-primary'} hover:underline`}
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        )}

        {/* Footer: file info */}
        {fileMeta && (
          <div className="pt-1 border-t border-border/30 flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
            <FileJson className="w-3 h-3" />
            <span>{(fileMeta.size / 1024).toFixed(1)} KB</span>
            {fileMeta.sha && (
              <span className="font-mono ml-1 opacity-60" title="SHA">{fileMeta.sha.slice(0, 7)}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}