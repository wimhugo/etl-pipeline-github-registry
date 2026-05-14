import React, { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * Shared filter bar for policy list pages.
 * Props:
 *   searchQuery, onSearchChange
 *   filters: { odrl_type: string, status: string }
 *   onFiltersChange: (filters) => void
 *   odrlTypes: string[]   – populated from data
 *   statuses: string[]    – populated from data
 */
export default function PolicyFilterBar({
  searchQuery,
  onSearchChange,
  filters = {},
  onFiltersChange,
  odrlTypes = [],
  statuses = [],
}) {
  const [open, setOpen] = useState(false);

  const activeCount = Object.values(filters).filter(v => v && v !== '').length;

  const set = (key, value) => onFiltersChange({ ...filters, [key]: value });
  const clear = () => onFiltersChange({ odrl_type: '', status: '' });

  return (
    <div className="space-y-2">
      {/* Search row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 bg-muted/50 text-sm"
            placeholder="Filter by label or ID…"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
        <Button
          variant={open ? 'secondary' : 'outline'}
          size="icon"
          className="relative shrink-0 h-9 w-9"
          title="Advanced filters"
          onClick={() => setOpen(o => !o)}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[9px] text-primary-foreground flex items-center justify-center font-semibold">
              {activeCount}
            </span>
          )}
        </Button>
      </div>

      {/* Advanced filter panel */}
      {open && (
        <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Advanced Filters</span>
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1 text-muted-foreground" onClick={clear}>
                <X className="w-3 h-3" /> Clear all
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* ODRL Type */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">ODRL Type</label>
              <div className="flex flex-wrap gap-1.5">
                {odrlTypes.length === 0 && (
                  <span className="text-xs text-muted-foreground italic">No values found in data</span>
                )}
                {odrlTypes.map(t => (
                  <Badge
                    key={t}
                    onClick={() => set('odrl_type', filters.odrl_type === t ? '' : t)}
                    className={`cursor-pointer text-[10px] px-2 py-0.5 border transition-colors ${
                      filters.odrl_type === t
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/40 text-muted-foreground border-border/40 hover:border-primary/50 hover:text-foreground'
                    }`}
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Status</label>
              <div className="flex flex-wrap gap-1.5">
                {statuses.length === 0 && (
                  <span className="text-xs text-muted-foreground italic">No values found in data</span>
                )}
                {statuses.map(s => (
                  <Badge
                    key={s}
                    onClick={() => set('status', filters.status === s ? '' : s)}
                    className={`cursor-pointer text-[10px] px-2 py-0.5 border transition-colors ${
                      filters.status === s
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/40 text-muted-foreground border-border/40 hover:border-primary/50 hover:text-foreground'
                    }`}
                  >
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}