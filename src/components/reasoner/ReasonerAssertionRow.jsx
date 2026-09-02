import React from 'react';
import { Trash2, ArrowLeftRight } from 'lucide-react';
import { curieOf, relLocal } from './reasonerFormat';

const TIER_BADGE = {
  Deterministic: 'bg-accent/15 text-accent',
  Corpus: 'bg-chart-1/15 text-chart-1',
  Probabilistic: 'bg-chart-3/15 text-chart-3',
};

export default function ReasonerAssertionRow({ assertion: a, onDelete, onReverse }) {
  const tierLabel = a.derivation === 'Deterministic' ? 'DET' : a.derivation === 'Corpus' ? 'CORP' : 'PROB';
  return (
    <div className="px-3 py-2 flex items-start gap-2 text-xs">
      <span className={`font-mono px-1.5 py-0.5 rounded shrink-0 ${TIER_BADGE[a.derivation] || 'bg-muted text-muted-foreground'}`}>
        {tierLabel}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-mono">
          <span className="text-foreground">{curieOf(a.subject)}</span>
          {a.subjectRole && <span className="text-muted-foreground/70"> as {relLocal(a.subjectRole)}</span>}
          {' '}<span className="text-muted-foreground">{relLocal(a.relation)}</span>{' '}
          <span className="text-foreground">{curieOf(a.object)}</span>
          {a.objectRole && <span className="text-muted-foreground/70"> as {relLocal(a.objectRole)}</span>}
        </div>
        {a.rationale && <div className="text-muted-foreground mt-0.5">{a.rationale}</div>}
        <div className="text-muted-foreground/70 mt-0.5">
          {a.source}
          {a.support != null && ` · support ${a.support}`}
          {a.confidence != null && ` · conf ${a.confidence.toFixed(2)}`}
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <button title="Reverse direction (swap subject/object and roles)"
          onClick={onReverse}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeftRight className="w-3.5 h-3.5" />
        </button>
        <button title="Delete assertion"
          onClick={onDelete}
          className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}