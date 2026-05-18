import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, FileCheck2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import WorkflowStep1UserContext from './WorkflowStep1UserContext';

// Workflow definitions
export const WORKFLOWS = {
  licence: {
    id: 'licence',
    label: 'Licence a Resource',
    icon: FileCheck2,
    defaultFor: ['Contributor'],
    steps: [
      { id: 'user-context', label: 'User Context' },
      { id: 'resource',     label: 'Resource',     placeholder: true },
      { id: 'licence',      label: 'Licence',      placeholder: true },
      { id: 'review',       label: 'Review',        placeholder: true },
    ],
  },
  reuse: {
    id: 'reuse',
    label: 'Reuse a Resource',
    icon: Search,
    defaultFor: ['End User'],
    steps: [
      { id: 'user-context', label: 'User Context' },
      { id: 'find',         label: 'Find Resource', placeholder: true },
      { id: 'match',        label: 'Match Policy',  placeholder: true },
      { id: 'apply',        label: 'Apply',         placeholder: true },
    ],
  },
};

export default function WorkflowPanel({ initialWorkflow = 'licence', onClose }) {
  const [activeWorkflow, setActiveWorkflow] = useState(initialWorkflow);
  const [currentStep, setCurrentStep] = useState(0);

  const workflow = WORKFLOWS[activeWorkflow];
  const steps = workflow.steps;
  const totalSteps = steps.length;

  const canBack = currentStep > 0;
  const canNext = currentStep < totalSteps - 1;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" style={{ background: 'rgba(0,0,0,0.35)' }}>
      <div className="w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">

        {/* Header: workflow selector + close */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-1.5">
            {Object.values(WORKFLOWS).map(w => {
              const Icon = w.icon;
              const active = activeWorkflow === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => { setActiveWorkflow(w.id); setCurrentStep(0); }}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all",
                    active
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {w.label}
                </button>
              );
            })}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Step progress bar */}
        <div className="px-5 pt-4 pb-2 shrink-0">
          <div className="flex items-center gap-0">
            {steps.map((step, i) => {
              const isActive = i === currentStep;
              const isDone = i < currentStep;
              return (
                <React.Fragment key={step.id}>
                  <button
                    onClick={() => !step.placeholder && setCurrentStep(i)}
                    disabled={step.placeholder && i > currentStep}
                    className={cn(
                      "flex flex-col items-center gap-1 flex-1 group",
                      step.placeholder && i > currentStep ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all",
                      isActive  ? "bg-primary border-primary text-primary-foreground"
                               : isDone ? "bg-accent border-accent text-accent-foreground"
                               : "bg-muted border-border text-muted-foreground"
                    )}>
                      {isDone ? '✓' : i + 1}
                    </div>
                    <span className={cn(
                      "text-[9px] font-medium text-center leading-tight",
                      isActive ? "text-primary" : isDone ? "text-accent" : "text-muted-foreground"
                    )}>
                      {step.label}
                    </span>
                  </button>
                  {i < totalSteps - 1 && (
                    <div className={cn(
                      "h-0.5 flex-1 mb-4 transition-all",
                      i < currentStep ? "bg-accent" : "bg-border/50"
                    )} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {steps[currentStep].id === 'user-context' && (
            <WorkflowStep1UserContext workflowId={activeWorkflow} />
          )}
          {steps[currentStep].placeholder && (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
              <span className="text-2xl">🚧</span>
              <p className="text-sm font-medium text-foreground">{steps[currentStep].label}</p>
              <p className="text-xs text-muted-foreground">This step will be implemented next.</p>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="px-5 py-4 border-t border-border/60 flex items-center justify-between shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs gap-1.5"
            onClick={() => setCurrentStep(s => s - 1)}
            disabled={!canBack}
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Step {currentStep + 1} of {totalSteps}
          </span>
          <Button
            size="sm"
            className="h-8 px-3 text-xs gap-1.5"
            onClick={() => setCurrentStep(s => s + 1)}
            disabled={!canNext}
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}