import React from 'react';
import { cn } from '@/lib/utils';
import { SOURCE_TYPES } from '@/lib/apiSourceTypes';

export default function ApiSourceTypeFilter({ active, onToggle, counts }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground mr-1">Show:</span>
      {SOURCE_TYPES.map((type) => {
        const on = active.includes(type);
        return (
          <button
            key={type}
            type="button"
            onClick={() => onToggle(type)}
            className={cn(
              'px-2.5 py-1 rounded-full border text-xs transition-colors',
              on
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/40',
            )}
          >
            {type}
            <span className={cn('ml-1.5', on ? 'opacity-70' : 'opacity-50')}>{counts[type] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}