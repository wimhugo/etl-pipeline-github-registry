import React, { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * Shared filter bar for policy list pages.
 *
 * Props:
 *   searchQuery, onSearchChange
 *   filters: { odrl_type: string, status: string }
 *   onFiltersChange: (filters) => void
 *   odrlTypes: string[]   – populated from data
 *   statuses: string[]    – populated from data
 *
 * Filter cards are laid out max-3 per row (1→2→3 columns responsive).
 * Each filter card accepts an optional `colSpan` for wider cards (future use).
 * Pills are listed one per row; if > 5 pills the list becomes scrollable (max-h ~8 rows).
 */

const PILL_SCROLL_THRESHOLD = 5;

function FilterPillList({ items, activeValue, onToggle }) {
  const scrollable = items.length > PILL_SCROLL_THRESHOLD;
  return (
    <div
      className={`space-y-1 ${scrollable ? 'max-h-36 overflow-y-auto pr-1' : ''}`}
    >
      {items.length === 0 && (
        <span className="text-xs text-muted-foreground italic">No values found in data</span>
      )}
      {items.map(val => (
        <div key={val}>
          <Badge
            onClick={() => onToggle(val)}
            className={`cursor-pointer text-[10px] px-2 py-0.5 border transition-colors w-full justify-start ${
              activeValue === val
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted/40 text-muted-foreground border-border/40 hover:border-primary/50 hover:text-foreground'
            }`}
          >
            {val}
          </Badge>
        </div>
      ))}
    </div>
  );
}

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

  // Filter card definitions – colSpan 1-3 (defaults to 1)
  const filterCards = [
    {
      key: 'odrl_type',
      label: 'ODRL Type',
      items: odrlTypes,
      activeValue: filters.odrl_type,
      onToggle: v => set('odrl_type', filters.odrl_type === v ? '' : v),
      colSpan: 1,
    },
    {
      key: 'status',
      label: 'Status',
      items: statuses,
      activeValue: filters.status,
      onToggle: v => set('status', filters.status === v ? '' : v),
      colSpan: 1,
    },
  ];

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
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Advanced Filters
            </span>
            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1 text-muted-foreground"
                onClick={clear}
              >
                <X className="w-3 h-3" /> Clear all
              </Button>
            )}
          </div>

          {/* Grid: max 3 columns, each card occupies its colSpan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterCards.map(card => (
              <div
                key={card.key}
                className={`space-y-1.5 ${card.colSpan === 2 ? 'sm:col-span-2' : ''} ${card.colSpan === 3 ? 'sm:col-span-2 lg:col-span-3' : ''}`}
              >
                <label className="text-xs text-muted-foreground">{card.label}</label>
                <FilterPillList
                  items={card.items}
                  activeValue={card.activeValue}
                  onToggle={card.onToggle}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}