import React from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const PILL_SCROLL_THRESHOLD = 6;

function FacetSection({ facetKey, label, items, facetState, onChange }) {
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
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <button
          onClick={toggleLogic}
          className="flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 border transition-colors select-none
            border-border/50 bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-foreground"
          title={logic === 'OR' ? 'Match any (OR) — click for AND' : 'Match all (AND) — click for OR'}
        >
          <span className={logic === 'OR' ? 'text-accent' : 'text-primary'}>{logic}</span>
        </button>
      </div>
      <div className={`space-y-1 ${scrollable ? 'max-h-48 overflow-y-auto pr-1' : ''}`}>
        {items.length === 0 && (
          <span className="text-xs text-muted-foreground italic">No values</span>
        )}
        {items.map(val => {
          const active = selected.includes(val);
          return (
            <Badge
              key={val}
              onClick={() => toggle(val)}
              className={`cursor-pointer text-[11px] px-2.5 py-1 border transition-colors w-full justify-start font-normal ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/40 text-muted-foreground border-border/40 hover:border-primary/50 hover:text-foreground'
              }`}
            >
              {val}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}

export default function PolicyFilterSidePanel({
  filters = {},
  onFiltersChange,
  odrlTypes = [],
  statuses = [],
}) {
  const activeCount = Object.values(filters).filter(f => f?.values?.length > 0).length;

  const handleFacetChange = (key, facetState) => {
    onFiltersChange({ ...filters, [key]: facetState });
  };

  const clear = () => onFiltersChange({});

  const facets = [
    { key: 'odrl_type', label: 'ODRL Type', items: odrlTypes },
    { key: 'status',    label: 'Status',    items: statuses },
  ];

  return (
    <div className="w-52 shrink-0 rounded-lg border border-border/50 bg-muted/20 p-4 space-y-4 self-start sticky top-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filters</span>
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs gap-1 text-muted-foreground"
            onClick={clear}
          >
            <X className="w-3 h-3" /> Clear
          </Button>
        )}
      </div>
      <div className="space-y-5">
        {facets.map(f => (
          <FacetSection
            key={f.key}
            facetKey={f.key}
            label={f.label}
            items={f.items}
            facetState={filters[f.key]}
            onChange={handleFacetChange}
          />
        ))}
      </div>
    </div>
  );
}