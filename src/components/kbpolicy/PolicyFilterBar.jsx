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
  filterPanelOpen = false,
  onToggleFilterPanel,
}) {
  const activeCount = Object.values(filters).filter(f => f?.values?.length > 0).length;

  return (
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
        variant={filterPanelOpen ? 'secondary' : 'outline'}
        size="icon"
        className="relative shrink-0 h-9 w-9"
        title="Toggle filter panel"
        onClick={onToggleFilterPanel}
      >
        <SlidersHorizontal className="w-4 h-4" />
        {activeCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[9px] text-primary-foreground flex items-center justify-center font-semibold">
            {activeCount}
          </span>
        )}
      </Button>
    </div>
  );
}