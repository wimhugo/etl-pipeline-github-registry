import React, { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * Shared filter bar for policy list pages.
 *
 * Facets support multi-select with AND / OR logic toggle per facet.
 * filters shape: { [facetKey]: { values: string[], logic: 'AND' | 'OR' } }
 */

const PILL_SCROLL_THRESHOLD = 5;

function FacetCard({ facetKey, label, items, facetState, onChange }) {
  const selected = facetState?.values || [];
  const logic = facetState?.logic || 'OR';

  const toggle = (val) => {
    const next = selected.includes(val)
      ? selected.filter(v => v !== val)
      : [...selected, val];
    onChange(facetKey, { values: next, logic });
  };

  const toggleLogic = () => {
    onChange(facetKey, { values: selected, logic: logic === 'OR' ? 'AND' : 'OR' });
  };

  const scrollable = items.length > PILL_SCROLL_THRESHOLD;

  return (
    <div className="space-y-1.5">
      {/* Facet header with AND/OR toggle */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs text-muted-foreground">{label}</label>
        <button
          onClick={toggleLogic}
          className="flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 border transition-colors select-none
            border-border/50 bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-foreground"
          title={logic === 'OR' ? 'Match any selected (OR) — click for AND' : 'Match all selected (AND) — click for OR'}
        >
          <span className={logic === 'OR' ? 'text-accent' : 'text-primary'}>{logic}</span>
        </button>
      </div>

      {/* Pills – one per row, scrollable if > threshold */}
      <div className={`space-y-1 ${scrollable ? 'max-h-36 overflow-y-auto pr-1' : ''}`}>
        {items.length === 0 && (
          <span className="text-xs text-muted-foreground italic">No values found in data</span>
        )}
        {items.map(val => {
          const active = selected.includes(val);
          return (
            <div key={val}>
              <Badge
                onClick={() => toggle(val)}
                className={`cursor-pointer text-[10px] px-2 py-0.5 border transition-colors w-full justify-start ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/40 text-muted-foreground border-border/40 hover:border-primary/50 hover:text-foreground'
                }`}
              >
                {val}
              </Badge>
            </div>
          );
        })}
      </div>
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

  const activeCount = Object.values(filters).filter(f => f?.values?.length > 0).length;

  const handleFacetChange = (key, facetState) => {
    onFiltersChange({ ...filters, [key]: facetState });
  };

  const clear = () => onFiltersChange({});

  const facetCards = [
    { key: 'odrl_type', label: 'ODRL Type', items: odrlTypes },
    { key: 'status',    label: 'Status',    items: statuses },
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

      {/* Facet panel */}
      {open && (
        <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Facets
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {facetCards.map(card => (
              <FacetCard
                key={card.key}
                facetKey={card.key}
                label={card.label}
                items={card.items}
                facetState={filters[card.key]}
                onChange={handleFacetChange}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}