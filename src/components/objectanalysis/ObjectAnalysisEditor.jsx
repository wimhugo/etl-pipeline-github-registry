import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Microscope, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import OAStepContentSource from './OAStepContentSource';
import OAStepRunAnalysis from './OAStepRunAnalysis';

const STEPS = [
  { id: 'content-source', label: 'Content Source' },
  { id: 'run-analysis',   label: 'Run Analysis' },
];

export default function ObjectAnalysisEditor({
  initialData,
  onClose,
  onSave,
  openrelActions,
  openrelConstraints,
}) {
  const isNew = !initialData?.id;

  const [currentStep, setCurrentStep] = useState(0);
  const [stepData, setStepData] = useState({
    name: '',
    description: '',
    inputType: 'url',
    objectUrl: '',
    textContent: '',
    analysisResult: null,
    actionMappings: {},
  });

  // Seed from initialData when opening
  useEffect(() => {
    setCurrentStep(0);
    setStepData({
      name: initialData?.name || '',
      description: initialData?.description || '',
      inputType: initialData?.input_type || 'url',
      objectUrl: initialData?.object_url || '',
      textContent: initialData?.text_content || '',
      analysisResult: initialData?.analysis_result || null,
      actionMappings: initialData?.action_mappings || {},
    });
  }, [initialData]);

  const handleSave = () => {
    if (!stepData.name.trim()) return;
    onSave({
      name: stepData.name.trim(),
      description: stepData.description.trim(),
      input_type: stepData.inputType,
      object_url: stepData.inputType === 'url' ? stepData.objectUrl : '',
      text_content: stepData.inputType === 'text' ? stepData.textContent : '',
      analysis_result: stepData.analysisResult,
      action_mappings: stepData.actionMappings,
    });
  };

  const canSave = stepData.name.trim().length > 0;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {stepData.name || (isNew ? 'New Object Analysis' : 'Edit Object Analysis')}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <Microscope className="w-3 h-3" /> Object Analysis
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 shrink-0"
          onClick={handleSave}
          disabled={!canSave}
        >
          <Save className="w-3.5 h-3.5" /> Save
        </Button>
      </div>

      {/* Step progress bar */}
      <div className="rounded-xl border border-border/50 bg-card px-6 py-4">
        <div className="flex items-center">
          {STEPS.map((step, i) => {
            const isActive = i === currentStep;
            const isDone = i < currentStep;
            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => setCurrentStep(i)}
                  className="flex flex-col items-center gap-1.5 flex-1 cursor-pointer"
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                    isActive ? "bg-primary border-primary text-primary-foreground"
                    : isDone  ? "bg-accent border-accent text-accent-foreground"
                              : "bg-muted/50 border-border text-muted-foreground"
                  )}>
                    {isDone ? '✓' : i + 1}
                  </div>
                  <span className={cn(
                    "text-[11px] font-medium text-center leading-tight",
                    isActive ? "text-primary"
                    : isDone  ? "text-accent"
                              : "text-muted-foreground"
                  )}>
                    {step.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
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
        {currentStep === 0 && (
          <OAStepContentSource data={stepData} onChange={setStepData} />
        )}
        {currentStep === 1 && (
          <OAStepRunAnalysis
            data={stepData}
            onChange={setStepData}
            openrelActions={openrelActions}
            openrelConstraints={openrelConstraints}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline" size="sm" className="gap-1.5"
          onClick={() => setCurrentStep(s => s - 1)}
          disabled={currentStep === 0}
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back
        </Button>
        <span className="text-xs text-muted-foreground">
          Step {currentStep + 1} of {STEPS.length}
        </span>
        <Button
          size="sm" className="gap-1.5"
          onClick={() => setCurrentStep(s => s + 1)}
          disabled={currentStep === STEPS.length - 1}
        >
          Next <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}