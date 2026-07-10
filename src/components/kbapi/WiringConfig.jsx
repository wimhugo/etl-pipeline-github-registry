import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Cable } from 'lucide-react';
import { LOGIC_TYPES } from '@/lib/apiLogicTypes';

export default function WiringConfig({ logicType, logicConfig = {}, onLogicTypeChange, onConfigChange, sourceFiles = [] }) {
  const selected = LOGIC_TYPES.find(t => t.value === logicType);

  return (
    <div className="space-y-2.5 rounded-lg border border-accent/20 bg-accent/5 p-3">
      <div className="flex items-center gap-2">
        <Cable className="w-3.5 h-3.5 text-accent" />
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Wiring</Label>
        {selected && (
          <Badge variant="outline" className="text-xs ml-auto font-mono">{selected.function_name}()</Badge>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Backend Function</Label>
        <Select value={logicType || ''} onValueChange={onLogicTypeChange}>
          <SelectTrigger className="h-8 bg-muted/50 text-xs">
            <SelectValue placeholder="Select a function…" />
          </SelectTrigger>
          <SelectContent>
            {LOGIC_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>
                <div className="flex flex-col">
                  <span>{t.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected?.description && (
          <p className="text-xs text-muted-foreground/60">{selected.description}</p>
        )}
      </div>

      {selected && selected.params.map(p => (
        <div key={p.key} className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            {p.label}
            {p.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {p.type === 'select_source_file' ? (
            <Select
              value={logicConfig[p.key] || ''}
              onValueChange={v => onConfigChange(p.key, v)}
            >
              <SelectTrigger className="h-8 bg-muted/50 text-xs">
                <SelectValue placeholder="Select source file section…" />
              </SelectTrigger>
              <SelectContent>
                {sourceFiles.map(sf => (
                  <SelectItem key={sf.id} value={sf.section}>{sf.section}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : p.type === 'boolean' ? (
            <div className="flex items-center gap-2 h-8">
              <Checkbox
                checked={logicConfig[p.key] ?? p.default ?? false}
                onCheckedChange={v => onConfigChange(p.key, v)}
                className="h-4 w-4"
              />
              <span className="text-xs text-muted-foreground">
                {(logicConfig[p.key] ?? p.default ?? false) ? 'Yes' : 'No'}
              </span>
            </div>
          ) : (
            <Input
              className="h-8 bg-muted/50 text-xs"
              type={p.type === 'number' ? 'number' : 'text'}
              value={logicConfig[p.key] ?? p.default ?? ''}
              onChange={e => onConfigChange(p.key, p.type === 'number' ? Number(e.target.value) : e.target.value)}
              placeholder={p.default?.toString() || ''}
            />
          )}
          {p.description && (
            <p className="text-xs text-muted-foreground/50">{p.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}