import React, { useState } from 'react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ReasonerStepCard({ step, icon: Icon, title, summary, children }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border border-border bg-card/50">
      <CollapsibleTrigger className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors">
        <span className="w-6 h-6 rounded-md bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
          {step}
        </span>
        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground shrink-0">{title}</span>
        <span className="text-xs text-muted-foreground truncate flex-1 text-right">{summary}</span>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform shrink-0', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4 pt-3 space-y-3 border-t border-border/60">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}