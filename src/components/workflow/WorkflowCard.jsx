import React from 'react';
import { FileCheck2, Search, MoreHorizontal, Pencil, Copy, Trash2, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

export const WORKFLOW_TYPES = {
  licence: {
    id: 'licence',
    label: 'Licence a Resource',
    description: 'Guide a resource owner through selecting and applying an appropriate licence to their resource.',
    icon: FileCheck2,
    color: 'text-primary',
    bg: 'bg-primary/10',
    steps: [
      { id: 'user-context', label: 'User Context' },
      { id: 'resource',     label: 'Resource',      placeholder: true },
      { id: 'licence',      label: 'Licence',       placeholder: true },
      { id: 'review',       label: 'Review',        placeholder: true },
    ],
  },
  reuse: {
    id: 'reuse',
    label: 'Reuse a Resource',
    description: 'Help a data consumer find a resource, understand its licence conditions, and apply it correctly.',
    icon: Search,
    color: 'text-accent',
    bg: 'bg-accent/10',
    steps: [
      { id: 'user-context',  label: 'User Context' },
      { id: 'find',          label: 'Find Resource' },
      { id: 'reuse-context', label: 'Reuse Context' },
      { id: 'match',         label: 'Match Policy',  placeholder: true },
      { id: 'apply',         label: 'Apply',         placeholder: true },
    ],
  },
};

export default function WorkflowCard({ instance, onOpen, onEdit, onClone, onDelete }) {
  const typeMeta = WORKFLOW_TYPES[instance.workflow_type] || WORKFLOW_TYPES.licence;
  const Icon = typeMeta.icon;

  const handleAction = (e, fn) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 hover:border-primary/30 transition-all group">
      <div className="flex items-start justify-between gap-3">
        {/* Icon + title */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={cn('p-2.5 rounded-lg shrink-0 mt-0.5', typeMeta.bg)}>
            <Icon className={cn('w-5 h-5', typeMeta.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{instance.name}</p>
            {instance.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{instance.description}</p>
            )}
            <Badge variant="outline" className={cn('mt-2 text-[10px] gap-1', typeMeta.color)}>
              <Icon className="w-3 h-3" />
              {typeMeta.label}
            </Badge>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            className="h-7 px-3 text-xs gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onOpen(instance)}
          >
            <Play className="w-3 h-3" /> Open
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={e => e.stopPropagation()}
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={e => handleAction(e, () => onEdit(instance))}>
                <Pencil className="w-3.5 h-3.5 mr-2" /> Edit details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={e => handleAction(e, () => onClone(instance))}>
                <Copy className="w-3.5 h-3.5 mr-2" /> Clone
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={e => handleAction(e, () => onDelete(instance))}
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Step pills */}
      <div className="flex flex-wrap gap-1.5 mt-4">
        {typeMeta.steps.map((step, i) => (
          <span
            key={step.id}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground border border-border/40"
          >
            <span className="text-[9px] font-bold">{i + 1}</span>
            {step.label}
            {step.placeholder && <span className="opacity-40">*</span>}
          </span>
        ))}
      </div>
    </div>
  );
}