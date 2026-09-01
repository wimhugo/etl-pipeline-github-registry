import React from 'react';
import { cn } from '@/lib/utils';
import { Plus, RefreshCw, AlertCircle, FileWarning, Lock } from 'lucide-react';

const fmt = (v) => {
  if (v === null || v === undefined) return '∅';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '∅';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

/**
 * IndexDiffPreview — renders the per-policy before/after diff produced by the
 * indexPolicies function. Auto-derived (writable) fields show added/changed
 * rows; curated fields are listed as locked.
 */
export default function IndexDiffPreview({ result }) {
  if (!result) return null;
  const changes = result.changes || [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary font-medium">{result.changed_count} changed</span>
        <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground">{result.unchanged_count} unchanged</span>
        {result.not_found_count > 0 && (
          <span className="px-2.5 py-1 rounded-md bg-destructive/10 text-destructive">{result.not_found_count} not found</span>
        )}
        <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground">index v{result.index_version || '—'}</span>
      </div>

      {result.parse_errors?.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <div className="flex items-center gap-2 text-sm text-destructive mb-1">
            <AlertCircle className="w-4 h-4" /> {result.parse_errors.length} TTL file(s) failed to parse
          </div>
          <ul className="text-xs text-muted-foreground space-y-0.5 font-mono">
            {result.parse_errors.map((e, i) => <li key={i}>{e.file}: {e.error}</li>)}
          </ul>
        </div>
      )}

      {changes.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">No policies in scope.</div>
      )}

      <div className="space-y-2.5">
        {changes.map((c) => (
          <PolicyDiffCard key={c.iri} c={c} />
        ))}
      </div>
    </div>
  );
}

function PolicyDiffCard({ c }) {
  const isNotFound = c.status === 'not_in_index' || c.status === 'no_ttl';
  const isUnchanged = c.status === 'unchanged';
  const added = c.added || [];
  const changed = c.changed || [];

  return (
    <div className={cn(
      'rounded-lg border bg-card overflow-hidden',
      isNotFound ? 'border-destructive/30' : isUnchanged ? 'border-border/60' : 'border-primary/40'
    )}>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/60 bg-muted/30">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{c.label || c.iri}</div>
          <div className="text-xs text-muted-foreground font-mono truncate">{c.iri}</div>
        </div>
        <StatusPill status={c.status} />
      </div>

      {isNotFound ? (
        <div className="px-4 py-3 flex items-center gap-2 text-sm text-destructive">
          <FileWarning className="w-4 h-4 shrink-0" />
          {c.status === 'not_in_index' ? 'IRI not present in the curated index.' : 'No matching policy TTL file found.'}
        </div>
      ) : (
        <div className="px-4 py-3 space-y-2.5">
          {added.length === 0 && changed.length === 0 ? (
            <div className="text-xs text-muted-foreground">No derived-field changes against the current index.</div>
          ) : (
            <div className="space-y-1">
              {[...added, ...changed].map((d, i) => (
                <div key={i} className="grid grid-cols-[auto_1fr_1fr] gap-x-3 items-start text-xs">
                  <div className="flex items-center gap-1.5 pt-0.5 text-muted-foreground font-mono whitespace-nowrap">
                    {d.status === 'added' ? <Plus className="w-3.5 h-3.5 text-accent" /> : <RefreshCw className="w-3.5 h-3.5 text-primary" />}
                    {d.field}
                  </div>
                  <div className="text-muted-foreground/70 line-through break-all font-mono">{fmt(d.before)}</div>
                  <div className="text-foreground break-all font-mono">{fmt(d.after)}</div>
                </div>
              ))}
            </div>
          )}

          {c.curated_fields?.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-border/40">
              <Lock className="w-3 h-3 text-muted-foreground/60" />
              <span className="text-[11px] text-muted-foreground/70">Preserved (curated):</span>
              {c.curated_fields.map((f) => (
                <span key={f} className="text-[11px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono">{f}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    changed: { cls: 'bg-primary/15 text-primary', label: 'changed' },
    unchanged: { cls: 'bg-muted text-muted-foreground', label: 'unchanged' },
    not_in_index: { cls: 'bg-destructive/15 text-destructive', label: 'not in index' },
    no_ttl: { cls: 'bg-destructive/15 text-destructive', label: 'no ttl' },
  };
  const s = map[status] || map.unchanged;
  return <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0', s.cls)}>{s.label}</span>;
}