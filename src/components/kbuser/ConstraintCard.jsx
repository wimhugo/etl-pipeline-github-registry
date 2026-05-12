import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

function IriPill({ href, label, colorClass }) {
  const inner = (
    <span className={`inline-flex items-center gap-1 rounded-full border font-mono text-[10px] px-2 py-0.5 transition-colors cursor-pointer ${colorClass}`}>
      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
      {label}
    </span>
  );
  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer">{inner}</a>;
  }
  return inner;
}

export default function ConstraintCard({ constraint }) {
  const [expanded, setExpanded] = useState(false);
  const definition = constraint.definition || constraint.description || constraint.comment;

  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
      <button
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="mt-0.5 text-muted-foreground shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-foreground">{constraint.label || constraint.id}</span>
          </div>
          {/* OpenREL IRI pill */}
          {constraint.id && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <IriPill
                href={constraint.id.startsWith('http') ? constraint.id : null}
                label={constraint.id}
                colorClass="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
              />
            </div>
          )}
        </div>
      </button>

      {expanded && definition && (
        <div className="px-4 pb-4 pt-2 border-t border-border/40 bg-muted/10">
          <p className="text-[13px] text-muted-foreground leading-relaxed">{definition}</p>
        </div>
      )}
    </div>
  );
}