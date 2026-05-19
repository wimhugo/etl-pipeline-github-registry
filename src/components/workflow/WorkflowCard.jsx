import React from 'react';
import { FileCheck2, Search, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_META = {
  licence: { icon: FileCheck2, color: 'text-primary', bg: 'bg-primary/10', label: 'Licence a Resource' },
  reuse:   { icon: Search,     color: 'text-accent',  bg: 'bg-accent/10',  label: 'Reuse a Resource'  },
};

export default function WorkflowCard({ workflow, onOpen }) {
  const meta = TYPE_META[workflow.id] || { icon: FileCheck2, color: 'text-muted-foreground', bg: 'bg-muted/30', label: workflow.label };
  const Icon = meta.icon;

  return (
    <button
      onClick={() => onOpen(workflow.id)}
      className="w-full text-left rounded-xl border border-border/50 bg-card p-5 hover:border-primary/40 hover:bg-muted/30 transition-all group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={cn('p-2.5 rounded-lg shrink-0', meta.bg)}>
            <Icon className={cn('w-5 h-5', meta.color)} />
          </div>
          <div>
            <p className="font-medium text-sm">{workflow.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{workflow.steps.length} steps</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {workflow.steps.map((step, i) => (
                <span
                  key={step.id}
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground border border-border/40"
                >
                  <span className="text-[9px] font-bold">{i + 1}</span>
                  {step.label}
                  {step.placeholder && <span className="opacity-50">*</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
      </div>
    </button>
  );
}