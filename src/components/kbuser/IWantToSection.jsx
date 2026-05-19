import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useRole } from '@/lib/RoleContext';
import { ArrowRight, FileCheck2, Search, Microscope, BookOpen, Zap, Lock, Users, Layers, Settings, GitBranch, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICON_MAP = {
  FileCheck2, Search, Microscope, BookOpen, Zap, Lock, Users, Layers, Settings, GitBranch, Star,
  ArrowRight,
};

export default function IWantToSection() {
  const navigate = useNavigate();
  const { allowedWorkflowTypes, kbUserFeatures, activeRole } = useRole();

  const { data: cards = [] } = useQuery({
    queryKey: ['featureCards'],
    queryFn: () => base44.entities.FeatureCard.list('order'),
  });

  const visibleCards = cards
    .filter(card => card.is_active !== false)
    .filter(card => {
      if (!card.linked_type) return true;
      // Workflow type permission check
      if (card.linked_type.startsWith('workflow_type:')) {
        const wfType = card.linked_type.replace('workflow_type:', '');
        return allowedWorkflowTypes.includes(wfType);
      }
      // KB User feature permission check
      const feature = kbUserFeatures.find(f => f.path === card.linked_type);
      if (feature) return feature.access[activeRole];
      return true;
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (visibleCards.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">I want to…</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visibleCards.map(card => {
          const Icon = ICON_MAP[card.icon_name] || Star;
          return (
            <button
              key={card.id}
              onClick={() => card.target_path && navigate(card.target_path)}
              className={cn(
                "group flex items-start gap-3 rounded-xl border border-border/50 bg-card p-4 text-left transition-all",
                "hover:border-primary/40 hover:bg-primary/5",
                !card.target_path && "cursor-default"
              )}
            >
              <div className="p-2 rounded-lg bg-primary/10 shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">{card.title}</p>
                {card.description && (
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{card.description}</p>
                )}
              </div>
              {card.target_path && (
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}