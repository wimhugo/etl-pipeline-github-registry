import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

// Known Policy model fields available as facet bases
const POLICY_FIELDS = [
  { value: 'odrl_type',   label: 'ODRL Type (odrl_type)' },
  { value: 'status',      label: 'Status (status)' },
  { value: 'creator',     label: 'Creator (creator)' },
  { value: 'jurisdiction', label: 'Jurisdiction (jurisdiction)' },
  { value: 'language',    label: 'Language (language)' },
  { value: 'issued',      label: 'Issued Date (issued)' },
  { value: 'modified',    label: 'Modified Date (modified)' },
  { value: 'subject',     label: 'Subject / Keywords (subject)' },
  { value: 'location',    label: 'Location (location)' },
  { value: 'rights',      label: 'Rights (rights)' },
  { value: 'relation',    label: 'Relation (relation)' },
];

const FACET_TYPES = [
  { value: 'pills',       label: 'Selectable Pills' },
  { value: 'search_list', label: 'Searchable Text Listing' },
  { value: 'chart',       label: 'Chart' },
  { value: 'timeline',    label: 'Timeline' },
  { value: 'map',         label: 'Map' },
];

const CHART_SUBTYPES = [
  { value: 'bar',   label: 'Bar Chart' },
  { value: 'pie',   label: 'Pie Chart' },
  { value: 'donut', label: 'Donut Chart' },
  { value: 'line',  label: 'Line Chart' },
];

const CONTEXTS = [
  { value: 'policies',    label: 'Policies' },
  { value: 'actions',     label: 'Actions' },
  { value: 'constraints', label: 'Constraints' },
];

const defaults = {
  title: '',
  field_key: 'odrl_type',
  facet_type: 'pills',
  chart_subtype: 'bar',
  default_logic: 'OR',
  max_visible_items: 6,
  is_active: true,
  sort_order: 0,
  context: 'policies',
};

export default function FacetEditDialog({ facet, existingCount, onSave, onClose }) {
  const [form, setForm] = useState(facet ? { ...facet } : { ...defaults, sort_order: existingCount });
  const isNew = !facet;

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = () => {
    if (!form.title.trim() || !form.field_key) return;
    onSave(form);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Add Facet' : 'Edit Facet'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label>Title <span className="text-destructive">*</span></Label>
            <Input
              placeholder="e.g. ODRL Type"
              value={form.title}
              onChange={e => set('title', e.target.value)}
            />
          </div>

          {/* Field key */}
          <div className="space-y-1.5">
            <Label>Policy Field <span className="text-destructive">*</span></Label>
            <Select value={form.field_key} onValueChange={v => set('field_key', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select field…" />
              </SelectTrigger>
              <SelectContent>
                {POLICY_FIELDS.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Context */}
          <div className="space-y-1.5">
            <Label>Applies To</Label>
            <Select value={form.context || 'policies'} onValueChange={v => set('context', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTEXTS.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Facet type */}
          <div className="space-y-1.5">
            <Label>Facet Type</Label>
            <Select value={form.facet_type} onValueChange={v => set('facet_type', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FACET_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Chart subtype — only when chart */}
          {form.facet_type === 'chart' && (
            <div className="space-y-1.5">
              <Label>Chart Sub-type</Label>
              <Select value={form.chart_subtype || 'bar'} onValueChange={v => set('chart_subtype', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHART_SUBTYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Default logic — pills & search_list */}
          {['pills', 'search_list'].includes(form.facet_type) && (
            <div className="space-y-1.5">
              <Label>Default Boolean Logic</Label>
              <Select value={form.default_logic || 'OR'} onValueChange={v => set('default_logic', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OR">OR — match any selected value</SelectItem>
                  <SelectItem value="AND">AND — match all selected values</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Max visible items */}
          {['pills', 'search_list'].includes(form.facet_type) && (
            <div className="space-y-1.5">
              <Label>Max Visible Items (before scroll)</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={form.max_visible_items ?? 6}
                onChange={e => set('max_visible_items', Number(e.target.value))}
              />
            </div>
          )}

          {/* Sort order */}
          <div className="space-y-1.5">
            <Label>Display Order</Label>
            <Input
              type="number"
              min={0}
              value={form.sort_order ?? 0}
              onChange={e => set('sort_order', Number(e.target.value))}
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <Switch checked={!!form.is_active} onCheckedChange={v => set('is_active', v)} id="is_active" />
            <Label htmlFor="is_active">Active (visible in filter panel)</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.title.trim() || !form.field_key}>
            {isNew ? 'Add Facet' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}