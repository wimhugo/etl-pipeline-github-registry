import React from 'react';
import { CheckCircle2, GraduationCap, FlaskConical, HelpCircle, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const BADGE_CONFIG = {
  verified_education: {
    icon: GraduationCap,
    label: 'Verified HEI',
    tooltip: 'Verified Higher Education Institution (ROR registry)',
    className: 'text-primary bg-primary/10 border-primary/30',
  },
  verified_research: {
    icon: FlaskConical,
    label: 'Verified Research Org',
    tooltip: 'Verified Research Organization (ROR registry)',
    className: 'text-accent bg-accent/10 border-accent/30',
  },
  unverified: {
    icon: HelpCircle,
    label: 'Not in registry',
    tooltip: 'Could not find this organization in the ROR registry',
    className: 'text-muted-foreground bg-muted/20 border-border/40',
  },
};

export default function InstitutionVerificationBadge({ status, match, loading }) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-muted/20 text-muted-foreground text-[10px] px-2 py-0.5">
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
        Checking...
      </span>
    );
  }

  const config = BADGE_CONFIG[status] || BADGE_CONFIG.unverified;
  const Icon = config.icon;

  const tooltipContent = (
    <div className="space-y-1 max-w-xs">
      <p className="font-medium">{config.tooltip}</p>
      {match && (
        <>
          {match.name && <p className="text-muted-foreground text-[11px]">Matched: {match.name}</p>}
          {match.country && <p className="text-muted-foreground text-[11px]">Country: {match.country}{match.is_eu ? ' 🇪🇺' : ''}</p>}
          {match.types?.length > 0 && <p className="text-muted-foreground text-[11px]">Types: {match.types.join(', ')}</p>}
          {match.ror_id && (
            <a
              href={match.ror_id}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary text-[11px] underline block"
              onClick={e => e.stopPropagation()}
            >
              View in ROR →
            </a>
          )}
        </>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(
            'inline-flex items-center gap-1 rounded-full border text-[10px] px-2 py-0.5 cursor-default',
            config.className
          )}>
            <Icon className="w-2.5 h-2.5" />
            {config.label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">{tooltipContent}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}