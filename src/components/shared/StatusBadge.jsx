import React from 'react';
import { cn } from '@/lib/utils';

const statusConfig = {
  active: { label: 'Active', dotColor: 'bg-accent', bgColor: 'bg-accent/10', textColor: 'text-accent' },
  paused: { label: 'Paused', dotColor: 'bg-chart-4', bgColor: 'bg-chart-4/10', textColor: 'text-chart-4' },
  error: { label: 'Error', dotColor: 'bg-destructive', bgColor: 'bg-destructive/10', textColor: 'text-destructive' },
  draft: { label: 'Draft', dotColor: 'bg-muted-foreground', bgColor: 'bg-muted', textColor: 'text-muted-foreground' },
  running: { label: 'Running', dotColor: 'bg-primary', bgColor: 'bg-primary/10', textColor: 'text-primary' },
  success: { label: 'Success', dotColor: 'bg-accent', bgColor: 'bg-accent/10', textColor: 'text-accent' },
  failed: { label: 'Failed', dotColor: 'bg-destructive', bgColor: 'bg-destructive/10', textColor: 'text-destructive' },
  cancelled: { label: 'Cancelled', dotColor: 'bg-muted-foreground', bgColor: 'bg-muted', textColor: 'text-muted-foreground' },
  connected: { label: 'Connected', dotColor: 'bg-accent', bgColor: 'bg-accent/10', textColor: 'text-accent' },
  disconnected: { label: 'Disconnected', dotColor: 'bg-muted-foreground', bgColor: 'bg-muted', textColor: 'text-muted-foreground' },
};

export default function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.draft;

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
      config.bgColor, config.textColor
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", config.dotColor, status === 'running' && "animate-pulse-glow")} />
      {config.label}
    </span>
  );
}