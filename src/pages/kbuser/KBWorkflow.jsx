import React, { useState, useEffect } from 'react';
import { useRole } from '@/lib/RoleContext';
import { FileCheck2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import WorkflowStep1UserContext from '@/components/workflow/WorkflowStep1UserContext';
import WorkflowStep2FindResource from '@/components/workflow/WorkflowStep2FindResource';
import WorkflowStep3IntendedUse from '@/components/workflow/WorkflowStep3IntendedUse';

const WORKFLOWS = {
  licence: {
    id: 'licence',
    label: 'Licence a Resource',
    icon: FileCheck2,
    steps: [
      { id: 'user-context', label: 'User Context' },
      { id: 'resource',     label: 'Resource',      placeholder: true },
      { id: 'licence',      label: 'Licence',       placeholder: true },
      { id: 'review',       label: 'Review',         placeholder: true },
    ],
  },
  reuse: {
    id: 'reuse',
    label: 'Reuse a Resource',
    icon: Search,
    steps: [
      { id: 'user-context', label: 'User Context' },
      { id: 'find',         label: 'Find Resource' },
      { id: 'intended-use', label: 'Intended Use' },
      { id: 'match',        label: 'Match Policy',   placeholder: true },
      { id: 'apply',        label: 'Apply',          placeholder: true },
    ],
  },
};

function defaultWorkflowForRole(role) {
  if (role === 'End User') return 'reuse';
  return 'licence';
}

const SELECTABLE_ROLES = new Set(['Administrator', 'Curator']);

export default function KBWorkflow() {
  const { activeRole } = useRole();
  const canSelect = SELECTABLE_ROLES.has(activeRole);

  const [activeWorkflow, setActiveWorkflow] = useState(defaultWorkflowForRole(activeRole));
  const [currentStep, setCurrentStep] = useState(0);

  // Sync workflow when role changes (unless the role is selectable)
  useEffect(() => {
    if (!SELECTABLE_ROLES.has(activeRole)) {
      setActiveWorkflow(defaultWorkflowForRole(activeRole));
      setCurrentStep(0);
    }
  }, [activeRole]);

  const workflow = WORKFLOWS[activeWorkflow];
  const steps = workflow.steps;

  const handleSelectWorkflow = (id) => {
    setActiveWorkflow(id);
    setCurrentStep(0);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workflow</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {canSelect
              ? 'Select a workflow and complete each step.'
              : `${workflow.label} — follow the steps below.`}
          </p>
        </div>

        {/* Workflow selector — only for Admin / Curator */}
        {canSelect && (
          <div className="flex items-center gap-1.5 shrink-0">
            {Object.values(WORKFLOWS).map(w => {
              const Icon = w.icon;
              const active = activeWorkflow === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => handleSelectWorkflow(w.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                    active
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {w.label}
                </button>
              );
            })}
          </div>
        )}
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
        {steps[currentStep].id === 'intended-use' && (
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