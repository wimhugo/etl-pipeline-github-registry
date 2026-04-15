import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function MappingEditor({ sourceFields = [], templateFields = [], mapping = {}, onChange }) {
  const [dragging, setDragging] = useState(null); // source field being dragged
  const [hovering, setHovering] = useState(null); // template field being hovered

  const handleDragStart = (field) => setDragging(field);
  const handleDragEnd = () => { setDragging(null); setHovering(null); };

  const handleDrop = (templateField) => {
    if (!dragging) return;
    onChange({ ...mapping, [templateField]: dragging });
    setDragging(null);
    setHovering(null);
  };

  const removeMapping = (templateField) => {
    const next = { ...mapping };
    delete next[templateField];
    onChange(next);
  };

  const mappedSources = new Set(Object.values(mapping));

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Drag a <span className="text-primary font-medium">source field</span> onto a <span className="text-accent font-medium">template field</span> to create a mapping.
      </p>

      <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-start">
        {/* Source fields */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Source Fields</p>
          {sourceFields.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Upload a source file to see fields</p>
          )}
          {sourceFields.map(field => (
            <div
              key={field}
              draggable
              onDragStart={() => handleDragStart(field)}
              onDragEnd={handleDragEnd}
              className={cn(
                "px-3 py-2 rounded-lg border text-sm font-mono cursor-grab active:cursor-grabbing select-none transition-all",
                mappedSources.has(field)
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/50 bg-muted/50 hover:border-primary/30 hover:bg-primary/5",
                dragging === field && "opacity-50 scale-95"
              )}
            >
              {field}
              {mappedSources.has(field) && <span className="ml-2 text-[10px] text-primary/60">mapped</span>}
            </div>
          ))}
        </div>

        {/* Center arrows */}
        <div className="flex flex-col items-center pt-8 gap-2">
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </div>

        {/* Template fields */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Template Fields</p>
          {templateFields.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Upload a template to see fields</p>
          )}
          {templateFields.map(field => {
            const mapped = mapping[field];
            const isHovered = hovering === field;
            return (
              <div
                key={field}
                onDragOver={e => { e.preventDefault(); setHovering(field); }}
                onDragLeave={() => setHovering(null)}
                onDrop={() => handleDrop(field)}
                className={cn(
                  "px-3 py-2 rounded-lg border text-sm font-mono transition-all relative",
                  mapped
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : isHovered
                    ? "border-primary border-dashed bg-primary/5 text-primary"
                    : "border-border/50 border-dashed bg-muted/30 text-muted-foreground"
                )}
              >
                <span>{field}</span>
                {mapped && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] text-muted-foreground">←</span>
                    <span className="text-[10px] text-primary font-mono">{mapped}</span>
                    <button onClick={() => removeMapping(field)} className="ml-auto text-muted-foreground hover:text-destructive transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {!mapped && isHovered && dragging && (
                  <div className="text-[10px] text-primary mt-1">Drop to map from "{dragging}"</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mapping summary */}
      {Object.keys(mapping).length > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/30">
          <p className="text-xs text-muted-foreground font-medium mb-2">Active Mappings ({Object.keys(mapping).length})</p>
          <div className="space-y-1">
            {Object.entries(mapping).map(([tpl, src]) => (
              <div key={tpl} className="flex items-center gap-2 text-xs font-mono">
                <span className="text-accent">{tpl}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span className="text-primary">{src}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}