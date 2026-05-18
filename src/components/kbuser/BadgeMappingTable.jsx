import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const COLOUR_OPTIONS = [
  { label: 'Green',   value: 'accent',      swatch: 'bg-accent',              cls: 'bg-accent/15 text-accent border-accent/40' },
  { label: 'Blue',    value: 'primary',     swatch: 'bg-primary',             cls: 'bg-primary/15 text-primary border-primary/40' },
  { label: 'Sky',     value: 'eu-blue',     swatch: 'bg-blue-500',            cls: 'bg-blue-500/15 text-blue-400 border-blue-400/40' },
  { label: 'Purple',  value: 'chart-3',     swatch: 'bg-chart-3',             cls: 'bg-chart-3/15 text-chart-3 border-chart-3/40' },
  { label: 'Yellow',  value: 'chart-4',     swatch: 'bg-chart-4',             cls: 'bg-chart-4/15 text-chart-4 border-chart-4/40' },
  { label: 'Red',     value: 'destructive', swatch: 'bg-destructive',         cls: 'bg-destructive/15 text-destructive border-destructive/40' },
  { label: 'Grey',    value: 'muted',       swatch: 'bg-muted-foreground',    cls: 'bg-muted/40 text-muted-foreground border-border/50' },
  { label: 'Orange',  value: 'chart-5',     swatch: 'bg-chart-5',             cls: 'bg-chart-5/15 text-chart-5 border-chart-5/40' },
  { label: 'Teal',    value: 'teal',        swatch: 'bg-teal-500',            cls: 'bg-teal-500/15 text-teal-400 border-teal-400/40' },
  { label: 'Pink',    value: 'pink',        swatch: 'bg-pink-500',            cls: 'bg-pink-500/15 text-pink-400 border-pink-400/40' },
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

export default function BadgeMappingTable({ rows = [], onChange, constraintOptions = [] }) {
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
      <div className="grid grid-cols-[1.5fr_1.5fr_140px_2fr_32px] gap-3 px-3 pb-2 border-b border-border/40">
        {['Profile Badge', 'Context Badge', 'Badge Colour', 'Constraint Mapping', ''].map((h, i) => (
          <span key={i} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</span>
        ))}
      </div>

      {/* Rows */}
      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground italic px-3 py-2">No mappings yet. Add a row below.</p>
      )}
      {rows.map((row, idx) => (
        <div
          key={idx}
          className={cn(
            "grid grid-cols-[1.5fr_1.5fr_140px_2fr_32px] gap-3 items-center px-3 py-2 rounded-md transition-colors",
            editIdx === idx ? "bg-muted/30" : "hover:bg-muted/20"
          )}
          onClick={() => setEditIdx(idx)}
        >
          {editIdx === idx ? (
            <>
              <select
                value={row.profileBadge}
                onChange={e => update(idx, 'profileBadge', e.target.value)}
                className="h-8 text-xs rounded-md border border-input bg-muted/50 px-2 text-foreground"
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
                className="h-8 text-xs rounded-md border border-input bg-muted/50 px-2 text-foreground"
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
                className="h-8 text-xs rounded-md border border-input bg-muted/50 px-2 text-foreground"
                onClick={e => e.stopPropagation()}
              >
                {COLOUR_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select
                value={row.constraintMapping}
                onChange={e => update(idx, 'constraintMapping', e.target.value)}
                className="h-8 text-xs rounded-md border border-input bg-muted/50 px-2 text-foreground"
                onClick={e => e.stopPropagation()}
              >
                <option value="">— Select constraint —</option>
                {constraintOptions.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </>
          ) : (
            <>
              <div className="h-8 flex items-center"><span className="text-xs text-foreground truncate">{row.profileBadge || <span className="text-muted-foreground italic">—</span>}</span></div>
              <div className="h-8 flex items-center"><span className="text-xs text-muted-foreground font-mono truncate">{row.contextBadge || '—'}</span></div>
              <div className="h-8 flex items-center gap-2">
                <span className={cn("w-4 h-4 rounded-full border shrink-0", COLOUR_OPTIONS.find(o => o.value === row.colour)?.swatch || 'bg-muted-foreground')} />
                <span className="text-xs text-foreground">{COLOUR_OPTIONS.find(o => o.value === row.colour)?.label || row.colour}</span>
              </div>
              <div className="h-8 flex items-center"><span className="text-xs text-foreground truncate">{row.constraintMapping || '—'}</span></div>
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