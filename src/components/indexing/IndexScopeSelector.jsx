import React from 'react';
import { cn } from '@/lib/utils';

/**
 * IndexScopeSelector — choose which policies to index:
 * "All policies" or a specific subset. Renders a searchable checkbox list of
 * policy IRIs pulled from the current curated index.
 */
export default function IndexScopeSelector({ policies, scope, setScope, selected, setSelected }) {
  const [q, setQ] = React.useState('');

  const toggle = (iri) => {
    const next = new Set(selected);
    if (next.has(iri)) next.delete(iri); else next.add(iri);
    setSelected(next);
  };

  const filtered = policies.filter((p) => {
    const s = (p.iri + ' ' + (p.label || '')).toLowerCase();
    return s.includes(q.toLowerCase());
  });

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border border-border bg-card p-1 text-sm">
        <button
          onClick={() => setScope('all')}
          className={cn('px-4 py-1.5 rounded-md transition-colors', scope === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
        >
          All policies ({policies.length})
        </button>
        <button
          onClick={() => setScope('selected')}
          className={cn('px-4 py-1.5 rounded-md transition-colors', scope === 'selected' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
        >
          Selected ({selected.size})
        </button>
      </div>

      {scope === 'selected' && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="p-3 border-b border-border">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by IRI or label…"
              className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary"
            />
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
            {filtered.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground text-center">No matching policies.</div>
            )}
            {filtered.map((p) => (
              <label key={p.iri} className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={selected.has(p.iri)}
                  onChange={() => toggle(p.iri)}
                  className="mt-0.5 accent-[hsl(var(--primary))]"
                />
                <div className="min-w-0">
                  <div className="text-sm text-foreground truncate">{p.label || p.iri}</div>
                  <div className="text-xs text-muted-foreground font-mono truncate">{p.iri}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}