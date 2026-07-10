import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronRight, Trash2, Plus, Copy } from 'lucide-react';
import WiringConfig from './WiringConfig';
import { LOGIC_TYPES } from '@/lib/apiLogicTypes';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const PARAM_IN = ['query', 'path', 'header'];

const methodColor = {
  GET: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  POST: 'bg-green-500/15 text-green-400 border-green-500/30',
  PUT: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  PATCH: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  DELETE: 'bg-red-500/15 text-red-400 border-red-500/30',
};

export default function ApiEndpointCard({ endpoint, onSave, onDelete, onClone, sourceFiles = [], availableTags = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => {
    setForm({ ...endpoint, tag: endpoint.tag || 'default', parameters: endpoint.parameters || [], target_logic_type: endpoint.target_logic_type || '', logic_config: endpoint.logic_config || {} });
  }, [endpoint]);

  const update = (field, val) => setForm(f => {
    const next = { ...f, [field]: val };
    // Auto-sync logic_config.section when the endpoint section changes
    // and the wiring uses fetchApiSourceContent (which reads section from logic_config)
    if (field === 'section' && (f.target_logic_type === 'fetchApiSourceContent' || !f.target_logic_type)) {
      next.logic_config = { ...(f.logic_config || {}), section: val };
    }
    return next;
  });
  const updateParam = (idx, field, val) => setForm(f => ({
    ...f,
    parameters: f.parameters.map((p, i) => i === idx ? { ...p, [field]: val } : p),
  }));
  const addParam = () => setForm(f => ({
    ...f,
    parameters: [...(f.parameters || []), { name: '', in: 'query', required: false, schema_type: 'string', description: '' }],
  }));
  const removeParam = (idx) => setForm(f => ({
    ...f,
    parameters: f.parameters.filter((_, i) => i !== idx),
  }));

  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <button onClick={() => setExpanded(v => !v)} className="shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </button>
        <Select value={form.method || 'GET'} onValueChange={v => update('method', v)}>
          <SelectTrigger className={`w-24 h-8 text-xs font-bold border ${methodColor[form.method] || methodColor.GET}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          className="flex-1 h-8 bg-muted/50 text-xs font-mono"
          value={form.path || ''}
          onChange={e => update('path', e.target.value)}
          placeholder="openrel/api/v0.4/actions"
        />
        <Badge variant="outline" className="text-xs shrink-0 hidden lg:inline-flex">{form.tag || 'default'}</Badge>
        <Badge variant="outline" className="text-xs shrink-0">{form.endpoint_type || 'list'}</Badge>
        {form.target_logic_type ? (
          <Badge variant="secondary" className="text-xs shrink-0 hidden md:inline-flex">
            {LOGIC_TYPES.find(t => t.value === form.target_logic_type)?.label || form.target_logic_type}
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs shrink-0 hidden md:inline-flex text-muted-foreground/50">No wiring</Badge>
        )}
        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => onSave(form)} disabled={!form.path?.trim()}>
          Save
        </Button>
        {onClone && (
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="Clone" onClick={() => onClone(endpoint)}>
            <Copy className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => onDelete(endpoint)}>
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </Button>
      </div>
      {expanded && (
        <div className="px-4 pb-3 space-y-3 border-t border-border/30 pt-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Section</Label>
              <Select value={form.section || ''} onValueChange={v => update('section', v)}>
                <SelectTrigger className="h-8 bg-muted/50 text-xs"><SelectValue placeholder="Select section…" /></SelectTrigger>
                <SelectContent>
                  {sourceFiles.map(sf => <SelectItem key={sf.id} value={sf.section}>{sf.section}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Summary</Label>
              <Input className="h-8 bg-muted/50 text-xs" value={form.summary || ''} onChange={e => update('summary', e.target.value)} placeholder="List Actions" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tag / Group</Label>
              <Input
                className="h-8 bg-muted/50 text-xs"
                value={form.tag || 'default'}
                onChange={e => update('tag', e.target.value)}
                placeholder="default"
                list="endpoint-tags-list"
              />
              <datalist id="endpoint-tags-list">
                {availableTags.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Endpoint Type</Label>
              <Select value={form.endpoint_type || 'list'} onValueChange={v => update('endpoint_type', v)}>
                <SelectTrigger className="h-8 bg-muted/50 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="list">list (returns array)</SelectItem>
                  <SelectItem value="detail">detail (returns object)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Input className="h-8 bg-muted/50 text-xs" value={form.description || ''} onChange={e => update('description', e.target.value)} placeholder="Lists all members of this section…" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Parameters</Label>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={addParam}>
                <Plus className="w-3 h-3" /> Add Parameter
              </Button>
            </div>
            {(form.parameters || []).length === 0 ? (
              <p className="text-xs text-muted-foreground/60">No parameters defined.</p>
            ) : (
              <div className="space-y-1.5">
                {form.parameters.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input className="h-7 w-32 bg-muted/50 text-xs font-mono" value={p.name} onChange={e => updateParam(i, 'name', e.target.value)} placeholder="prefix" />
                    <Select value={p.in || 'query'} onValueChange={v => updateParam(i, 'in', v)}>
                      <SelectTrigger className="h-7 w-24 text-xs bg-muted/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PARAM_IN.map(pi => <SelectItem key={pi} value={pi}>{pi}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1 w-16 shrink-0">
                      <Checkbox checked={p.required || false} onCheckedChange={v => updateParam(i, 'required', v)} className="h-4 w-4" />
                      <span className="text-xs text-muted-foreground">required</span>
                    </div>
                    <Input className="h-7 flex-1 bg-muted/50 text-xs" value={p.description || ''} onChange={e => updateParam(i, 'description', e.target.value)} placeholder="Parameter description…" />
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => removeParam(i)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <WiringConfig
            logicType={form.target_logic_type}
            logicConfig={form.logic_config}
            onLogicTypeChange={(v) => setForm(f => ({ ...f, target_logic_type: v, logic_config: {} }))}
            onConfigChange={(key, val) => setForm(f => ({
              ...f,
              section: key === 'section' ? val : f.section,
              logic_config: { ...(f.logic_config || {}), [key]: val },
            }))}
            sourceFiles={sourceFiles}
          />
        </div>
      )}
    </div>
  );
}