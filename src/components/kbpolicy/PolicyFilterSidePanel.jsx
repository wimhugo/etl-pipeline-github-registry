import React, { useState } from 'react';
import { X, Settings2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useRole } from '@/lib/RoleContext';
import { useNavigate } from 'react-router-dom';
import ChartFacet from '@/components/kbsearch/ChartFacet';

// ── Facet renderers ────────────────────────────────────────────────

function PillsFacet({ facetKey, facet, items, facetState, onChange }) {
  const selected = facetState?.values || [];
  const logic = facetState?.logic || facet.default_logic || 'OR';
  const maxVisible = facet.max_visible_items ?? 6;

  const toggle = (val) => {
    const next = selected.includes(val)
      ? selected.filter(v => v !== val)
      : [...selected, val];
    onChange(facetKey, { values: next, logic });
  };

  const toggleLogic = () => {
    onChange(facetKey, { values: selected, logic: logic === 'OR' ? 'AND' : 'OR' });
  };

  const scrollable = items.length > maxVisible;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">{facet.title}</span>
        <button
          onClick={toggleLogic}
          className="flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 border transition-colors select-none border-border/50 bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-foreground"
          title={logic === 'OR' ? 'Match any (OR) — click for AND' : 'Match all (AND) — click for OR'}
        >
          <span className={logic === 'OR' ? 'text-accent' : 'text-primary'}>{logic}</span>
        </button>
      </div>
      <div className={`space-y-1 ${scrollable ? 'max-h-48 overflow-y-auto pr-1' : ''}`}>
        {items.length === 0 && <span className="text-xs text-muted-foreground italic">No values</span>}
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

function SearchListFacet({ facetKey, facet, items, facetState, onChange }) {
  const [search, setSearch] = React.useState('');
  const selected = facetState?.values || [];
  const logic = facetState?.logic || facet.default_logic || 'OR';

  const filtered = items.filter(v => v.toLowerCase().includes(search.toLowerCase()));

  const toggle = (val) => {
    const next = selected.includes(val)
      ? selected.filter(v => v !== val)
      : [...selected, val];
    onChange(facetKey, { values: next, logic });
  };

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-foreground">{facet.title}</span>
      <input
        className="w-full rounded border border-border/50 bg-muted/30 px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder="Search…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
        {filtered.length === 0 && <span className="text-xs text-muted-foreground italic">No matches</span>}
        {filtered.map(val => {
          const active = selected.includes(val);
          return (
            <div
              key={val}
              onClick={() => toggle(val)}
              className={`cursor-pointer text-xs px-2 py-1 rounded transition-colors ${
                active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/60 text-muted-foreground'
              }`}
            >
              {val}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlaceholderFacet({ facet, typeName }) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-semibold text-foreground">{facet.title}</span>
      <div className="rounded border border-border/30 bg-muted/10 px-3 py-3 text-center text-xs text-muted-foreground italic">
        {typeName} — coming soon
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────

export default function PolicyFilterSidePanel({ filters = {}, onFiltersChange, dataByField = {}, countsByField = {} }) {
  const { activeRole } = useRole();
  const navigate = useNavigate();
  const isAdmin = activeRole === 'Administrator';

  const { data: facetConfigs = [] } = useQuery({
    queryKey: ['facetConfigs'],
    queryFn: () => base44.entities.FacetConfig.list('sort_order', 100),
  });

  const activeFacets = facetConfigs
    .filter(f => f.is_active !== false && (f.context || 'policies') === 'policies')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  // Fall back to hardcoded defaults if no facets have been configured yet
  const fallbackFacets = activeFacets.length === 0
    ? [
        { id: '__odrl', title: 'ODRL Type', field_key: 'odrl_type', facet_type: 'pills', default_logic: 'OR', max_visible_items: 6 },
        { id: '__status', title: 'Status',   field_key: 'status',    facet_type: 'pills', default_logic: 'OR', max_visible_items: 6 },
      ]
    : activeFacets;

  const activeCount = Object.values(filters).filter(f => f?.values?.length > 0).length;
  const clear = () => onFiltersChange({});

  const handleFacetChange = (key, facetState) => {
    onFiltersChange({ ...filters, [key]: facetState });
  };

  const renderFacet = (facet) => {
    const items = dataByField[facet.field_key] || [];
    const facetState = filters[facet.field_key];

    switch (facet.facet_type) {
      case 'pills':
        return <PillsFacet key={facet.id} facetKey={facet.field_key} facet={facet} items={items} facetState={facetState} onChange={handleFacetChange} />;
      case 'search_list':
        return <SearchListFacet key={facet.id} facetKey={facet.field_key} facet={facet} items={items} facetState={facetState} onChange={handleFacetChange} />;
      case 'chart':
        return <ChartFacet key={facet.id} facetKey={facet.field_key} facet={facet} counts={countsByField[facet.field_key] || {}} facetState={facetState} onChange={handleFacetChange} />;
      case 'timeline':
        return <PlaceholderFacet key={facet.id} facet={facet} typeName="Timeline" />;
      case 'map':
        return <PlaceholderFacet key={facet.id} facet={facet} typeName="Map" />;
      default:
        return null;
    }
  };

  return (
    <div className="w-52 shrink-0 rounded-lg border border-border/50 bg-muted/20 p-4 space-y-4 self-start sticky top-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filters</span>
        <div className="flex items-center gap-1">
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1 text-muted-foreground" onClick={clear}>
              <X className="w-3 h-3" /> Clear
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              title="Configure facets"
              onClick={() => navigate('/facet-config')}
            >
              <Settings2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Facets */}
      <div className="space-y-5">
        {fallbackFacets.map(renderFacet)}
      </div>
    </div>
  );
}