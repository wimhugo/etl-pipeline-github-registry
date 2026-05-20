import React from 'react';
import { Pencil, Trash2, ArrowUp, ArrowDown, BarChart2, List, Pill, Map, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

const TYPE_META = {
  pills:       { label: 'Selectable Pills', icon: Pill,     color: 'bg-primary/10 text-primary' },
  search_list: { label: 'Searchable List',  icon: List,     color: 'bg-accent/10 text-accent' },
  chart:       { label: 'Chart',            icon: BarChart2, color: 'bg-yellow-500/10 text-yellow-400' },
  timeline:    { label: 'Timeline',         icon: Clock,    color: 'bg-purple-500/10 text-purple-400' },
  map:         { label: 'Map',              icon: Map,      color: 'bg-green-500/10 text-green-400' },
};

export default function FacetCard({ facet, isFirst, isLast, onEdit, onDelete, onMoveUp, onMoveDown, onToggleActive }) {
  const meta = TYPE_META[facet.facet_type] || TYPE_META.pills;
  const Icon = meta.icon;

  return (
    <div className={`rounded-lg border bg-card p-4 flex items-start gap-4 transition-opacity ${!facet.is_active ? 'opacity-50' : ''}`}>
      {/* Type icon */}
      <div className={`mt-0.5 p-2 rounded-md shrink-0 ${meta.color}`}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{facet.title}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">{facet.field_key}</Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{meta.label}</Badge>
          {facet.facet_type === 'chart' && facet.chart_subtype && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{facet.chart_subtype}</Badge>
          )}
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{facet.context || 'policies'}</Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span>Logic: <strong>{facet.default_logic || 'OR'}</strong></span>
          <span>Max visible: <strong>{facet.max_visible_items ?? 6}</strong></span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Switch checked={!!facet.is_active} onCheckedChange={onToggleActive} className="scale-75" />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp} disabled={isFirst} title="Move up">
          <ArrowUp className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown} disabled={isLast} title="Move down">
          <ArrowDown className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Edit">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete} title="Delete">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}