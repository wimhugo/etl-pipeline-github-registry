import React, { useState, useEffect } from 'react';
import { useRole } from '@/lib/RoleContext';
import { FileCheck2, Search, ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import WorkflowStep1UserContext from '@/components/workflow/WorkflowStep1UserContext';
import WorkflowStep2FindResource from '@/components/workflow/WorkflowStep2FindResource';
import WorkflowStep3IntendedUse from '@/components/workflow/WorkflowStep3IntendedUse';
import WorkflowCard from '@/components/workflow/WorkflowCard';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';

const WORKFLOWS = {
  licence: {
    id: 'licence',
    label: 'Licence a Resource',
    type: 'licence',
    icon: FileCheck2,
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
    type: 'reuse',
    icon: Search,
    steps: [
      { id: 'user-context',  label: 'User Context' },
      { id: 'find',          label: 'Find Resource' },
      { id: 'reuse-context', label: 'Reuse Context' },
      { id: 'match',         label: 'Match Policy',  placeholder: true },
      { id: 'apply',         label: 'Apply',         placeholder: true },
    ],
  },
};

const TYPE_LABELS = {
  licence: 'Licence a Resource',
  reuse:   'Reuse a Resource',
};

export default function KBWorkflow() {
  const { activeRole } = useRole();

  // List view state
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);

  // Detail view state
  const [activeWorkflow, setActiveWorkflow] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);

  // Reset detail when role changes
  useEffect(() => {
    setActiveWorkflow(null);
    setCurrentStep(0);
  }, [activeRole]);

  const allWorkflows = Object.values(WORKFLOWS);

  const filtered = allWorkflows.filter(w => {
    const matchesSearch =
      !search ||
      w.label.toLowerCase().includes(search.toLowerCase()) ||
      w.steps.some(s => s.label.toLowerCase().includes(search.toLowerCase()));
    const matchesType = typeFilter.length === 0 || typeFilter.includes(w.type);
    return matchesSearch && matchesType;
  });

  const toggleType = (type) => {
    setTypeFilter(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const openWorkflow = (id) => {
    setActiveWorkflow(id);
    setCurrentStep(0);
  };

  const closeWorkflow = () => {
    setActiveWorkflow(null);
    setCurrentStep(0);
  };

  // ── Detail view ──────────────────────────────────────────────
  if (activeWorkflow) {
    const workflow = WORKFLOWS[activeWorkflow];
    const steps = workflow.steps;
    const Icon = workflow.icon;

    return (
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={closeWorkflow}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Icon className="w-5 h-5 text-primary" />
              {workflow.label}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Follow the steps below.</p>
          </div>
        </div>

        {/* Step progress bar */}
        <div className="rounded-xl border border-border/50 bg-card px-6 py-4">
          <div className="flex items-center">
            {steps.map((step, i) => {
              const isActive = i === currentStep;
              const isDone = i < currentStep;
              const isClickable = !step.placeholder || isDone;
              return (
                <React.Fragment key={step.id}>
                  <button
                    onClick={() => isClickable && setCurrentStep(i)}
                    disabled={!isClickable}
                    className={cn(
                      "flex flex-col items-center gap-1.5 flex-1",
                      isClickable ? "cursor-pointer" : "cursor-default"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                      isActive  ? "bg-primary border-primary text-primary-foreground"
                      : isDone  ? "bg-accent border-accent text-accent-foreground"
                                : "bg-muted/50 border-border text-muted-foreground"
                    )}>
                      {isDone ? '✓' : i + 1}
                    </div>
                    <span className={cn(
                      "text-[11px] font-medium text-center leading-tight",
                      isActive  ? "text-primary"
                      : isDone  ? "text-accent"
                                : "text-muted-foreground"
                    )}>
                      {step.label}
                    </span>
                  </button>
                  {i < steps.length - 1 && (
                    <div className={cn(
                      "h-0.5 flex-1 mb-5 transition-all",
                      i < currentStep ? "bg-accent" : "bg-border/50"
                    )} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div>
          {steps[currentStep].id === 'user-context' && (
            <WorkflowStep1UserContext workflowId={activeWorkflow} />
          )}
          {steps[currentStep].id === 'find' && (
            <WorkflowStep2FindResource />
          )}
          {steps[currentStep].id === 'reuse-context' && (
            <WorkflowStep3IntendedUse workflowId={activeWorkflow} />
          )}
          {steps[currentStep].placeholder && steps[currentStep].id !== 'find' && (
            <div className="rounded-xl border border-border/50 bg-card flex flex-col items-center justify-center py-20 gap-3 text-center">
              <span className="text-3xl">🚧</span>
              <p className="text-sm font-medium text-foreground">{steps[currentStep].label}</p>
              <p className="text-xs text-muted-foreground">This step will be implemented in a future iteration.</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setCurrentStep(s => s - 1)}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </Button>
          <span className="text-xs text-muted-foreground">
            Step {currentStep + 1} of {steps.length}
          </span>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setCurrentStep(s => s + 1)}
            disabled={currentStep === steps.length - 1}
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workflow</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select a workflow to begin.
        </p>
      </div>

      {/* Search + filter bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search workflows..."
            className="pl-9 bg-muted/50 text-sm"
          />
        </div>

        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("gap-1.5", typeFilter.length > 0 && "border-primary/60 text-primary")}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filter
              {typeFilter.length > 0 && (
                <span className="ml-1 bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">
                  {typeFilter.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-3 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Workflow Type</p>
              {typeFilter.length > 0 && (
                <button
                  onClick={() => setTypeFilter([])}
                  className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
            {Object.entries(TYPE_LABELS).map(([type, label]) => (
              <label key={type} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={typeFilter.includes(type)}
                  onChange={() => toggleType(type)}
                  className="rounded border-border accent-primary"
                />
                <span className="text-sm group-hover:text-foreground text-muted-foreground">{label}</span>
              </label>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      {/* Workflow cards */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-card flex flex-col items-center justify-center py-16 gap-2 text-center">
          <p className="text-sm font-medium">No workflows match your filter.</p>
          <p className="text-xs text-muted-foreground">Try adjusting the search or filter.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map(w => (
            <WorkflowCard key={w.id} workflow={w} onOpen={openWorkflow} />
          ))}
        </div>
      )}
    </div>
  );
}