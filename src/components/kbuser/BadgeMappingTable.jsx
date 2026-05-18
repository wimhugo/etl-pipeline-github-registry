import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const COLOUR_OPTIONS = [
  { label: 'Green (Accent)',  value: 'accent',      cls: 'bg-accent/15 text-accent border-accent/40' },
  { label: 'Blue (Primary)',  value: 'primary',     cls: 'bg-primary/15 text-primary border-primary/40' },
  { label: 'EU Blue',         value: 'eu-blue',     cls: 'bg-blue-500/15 text-blue-400 border-blue-400/40' },
  { label: 'Purple (Chart3)', value: 'chart-3',     cls: 'bg-chart-3/15 text-chart-3 border-chart-3/40' },
  { label: 'Yellow (Chart4)', value: 'chart-4',     cls: 'bg-chart-4/15 text-chart-4 border-chart-4/40' },
  { label: 'Red (Destructive)', value: 'destructive', cls: 'bg-destructive/15 text-destructive border-destructive/40' },
  { label: 'Grey (Muted)',    value: 'muted',       cls: 'bg-muted/40 text-muted-foreground border-border/50' },
];

export function getColourClass(value) {
  return COLOUR_OPTIONS.find(o => o.value === value)?.cls || COLOUR_OPTIONS[6].cls;
}

// All badge labels sourced from WorkflowStep1UserContext (SignalPill) and UserProfilePanel
const PROFILE_BADGE_OPTIONS = [
  // Researcher / institution verification (from SignalPill & UserProfilePanel)
  'Verified HEI Researcher',
  'Verified Researcher',
  'Verified HEI',
  'Verified Research Org',
  // Institution type signals
  'Higher Education Institution',
  'Research Org',
  // EU membership
  'EU Member',
  // Research context checkboxes
  'Publicly Funded Research',
  'Commercial Research',
  'Commercial Application of Results',
];

// Context badges from "Verified Context" section in WorkflowStep1UserContext (includes positive/negative states)
const CONTEXT_BADGE_OPTIONS = [
  // Researcher verification status
  'verified_education',
  'verified_research',
  'researcher_unverified',
  // Institution type
  'hei_institution',
  'research_org',
  'not_hei_research_org',
  // EU membership
  'eu_member',
  'non_eu',
  'eu_unknown',
  // Research context (internal keys)
  'publicly_funded_research',
  'commercial_research',
  'commercial_application_of_results',
];

const EMPTY_ROW = { profileBadge: '', contextBadge: '', colour: 'muted', constraintMapping: '' };

export default function BadgeMappingTable({ rows = [], onChange }) {
  const [editIdx, setEditIdx] = useState(null);

  const update = (idx, field, value) => {
    const updated = rows.map((r, i) => i === idx ? { ...r, [field]: value } : r);
    onChange(updated);
  };

  const addRow = () => {
    onChange([...rows, { ...EMPTY_ROW }]);
    setEditIdx(rows.length);
  };

  const removeRow = (idx) => {
    onChange(rows.filter((_, i) => i !== idx));
    setEditIdx(null);
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="grid grid-cols-[1fr_1fr_120px_1fr_32px] gap-2 px-2 pb-1 border-b border-border/40">
        {['Profile Badge', 'Context Badge', 'Badge Colour', 'Constraint Mapping', ''].map((h, i) => (
          <span key={i} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</span>
        ))}
      </div>

      {/* Rows */}
      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground italic px-2 py-2">No mappings yet. Add a row below.</p>
      )}
      {rows.map((row, idx) => (
        <div
          key={idx}
          className={cn(
            "grid grid-cols-[1fr_1fr_120px_1fr_32px] gap-2 items-center px-2 py-1.5 rounded-md transition-colors",
            editIdx === idx ? "bg-muted/30" : "hover:bg-muted/20"
          )}
          onClick={() => setEditIdx(idx)}
        >
          {editIdx === idx ? (
            <>
              <select
                value={row.profileBadge}
                onChange={e => update(idx, 'profileBadge', e.target.value)}
                className="h-7 text-xs rounded-md border border-input bg-muted/50 px-1.5 text-foreground"
                onClick={e => e.stopPropagation()}
              >
                <option value="">— Select badge —</option>
                {PROFILE_BADGE_OPTIONS.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <select
                value={row.contextBadge}
                onChange={e => update(idx, 'contextBadge', e.target.value)}
                className="h-7 text-xs rounded-md border border-input bg-muted/50 px-1.5 text-foreground"
                onClick={e => e.stopPropagation()}
              >
                <option value="">— Select context —</option>
                {CONTEXT_BADGE_OPTIONS.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <select
                value={row.colour}
                onChange={e => update(idx, 'colour', e.target.value)}
                className="h-7 text-xs rounded-md border border-input bg-muted/50 px-1.5 text-foreground"
                onClick={e => e.stopPropagation()}
              >
                {COLOUR_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <Input
                value={row.constraintMapping}
                onChange={e => update(idx, 'constraintMapping', e.target.value)}
                className="h-7 text-xs bg-muted/50"
                placeholder="e.g. hei_researcher, eu_member"
                onClick={e => e.stopPropagation()}
              />
            </>
          ) : (
            <>
              <span className="text-xs text-foreground truncate">{row.profileBadge || <span className="text-muted-foreground italic">—</span>}</span>
              <span className="text-xs text-muted-foreground font-mono truncate">{row.contextBadge || '—'}</span>
              <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium w-fit", getColourClass(row.colour))}>
                {COLOUR_OPTIONS.find(o => o.value === row.colour)?.label || row.colour}
              </span>
              <span className="text-xs text-muted-foreground truncate">{row.constraintMapping || '—'}</span>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
            onClick={e => { e.stopPropagation(); removeRow(idx); }}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}

      <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 mt-1" onClick={addRow}>
        <Plus className="w-3.5 h-3.5" /> Add Row
      </Button>
    </div>
  );
}