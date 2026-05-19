import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, ChevronLeft, ChevronRight, Plus, SlidersHorizontal, X, GitBranch, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import WorkflowCard, { WORKFLOW_TYPES } from '@/components/workflow/WorkflowCard';
import WorkflowNewDialog from '@/components/workflow/WorkflowNewDialog';
import WorkflowEditDialog from '@/components/workflow/WorkflowEditDialog';
import WorkflowStep1UserContext from '@/components/workflow/WorkflowStep1UserContext';
import WorkflowStep2FindResource from '@/components/workflow/WorkflowStep2FindResource';
import WorkflowStep3IntendedUse from '@/components/workflow/WorkflowStep3IntendedUse';
import EmptyState from '@/components/shared/EmptyState';

const TYPE_LABELS = Object.fromEntries(
  Object.values(WORKFLOW_TYPES).map(wt => [wt.id, wt.label])
);

export default function KBWorkflow() {
  const queryClient = useQueryClient();

  // List view state
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [editingInstance, setEditingInstance] = useState(null);
  const [deletingInstance, setDeletingInstance] = useState(null);

  // Detail view state
  const [openInstance, setOpenInstance] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);

  // ── Data ──────────────────────────────────────────────────────
  const { data: instances = [], isLoading } = useQuery({
    queryKey: ['workflow-instances'],
    queryFn: () => base44.entities.WorkflowInstance.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.WorkflowInstance.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflow-instances'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WorkflowInstance.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflow-instances'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WorkflowInstance.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-instances'] });
      setDeletingInstance(null);
    },
  });

  const cloneMutation = useMutation({
    mutationFn: (inst) => {
      const { id, created_date, updated_date, created_by, ...rest } = inst;
      return base44.entities.WorkflowInstance.create({ ...rest, name: `${inst.name} (copy)` });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflow-instances'] }),
  });

  // ── Filtering ─────────────────────────────────────────────────
  const filtered = instances.filter(inst => {
    const matchesSearch =
      !search ||
      inst.name?.toLowerCase().includes(search.toLowerCase()) ||
      inst.description?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter.length === 0 || typeFilter.includes(inst.workflow_type);
    return matchesSearch && matchesType;
  });

  const toggleType = (type) =>
    setTypeFilter(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);

  // ── Handlers ──────────────────────────────────────────────────
  const handleOpen = (instance) => {
    // Seed localStorage from persisted step_data before opening
    if (instance.step_data && typeof instance.step_data === 'object') {
      Object.entries(instance.step_data).forEach(([stepId, value]) => {
        localStorage.setItem(`wf_${instance.id}_${stepId}`, JSON.stringify(value));
      });
    }
    setOpenInstance(instance);
    setCurrentStep(0);
    updateMutation.mutate({ id: instance.id, data: { last_opened_at: new Date().toISOString() } });
  };

  const handleClose = () => {
    setOpenInstance(null);
    setCurrentStep(0);
  };

  // ── Save step data ────────────────────────────────────────────
  const handleSaveProgress = () => {
    if (!openInstance) return;
    const typeMeta = WORKFLOW_TYPES[openInstance.workflow_type] || WORKFLOW_TYPES.licence;
    const stepData = {};
    typeMeta.steps.forEach(step => {
      const raw = localStorage.getItem(`wf_${openInstance.id}_${step.id}`);
      if (raw) {
        try { stepData[step.id] = JSON.parse(raw); } catch { stepData[step.id] = raw; }
      }
    });
    updateMutation.mutate({ id: openInstance.id, data: { step_data: stepData } });
  };

  // ── Detail view ───────────────────────────────────────────────
  if (openInstance) {
    const typeMeta = WORKFLOW_TYPES[openInstance.workflow_type] || WORKFLOW_TYPES.licence;
    const steps = typeMeta.steps;
    const Icon = typeMeta.icon;

    return (
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleClose}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">{openInstance.name}</h1>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Icon className="w-3 h-3" /> {typeMeta.label}
            </p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={handleSaveProgress}>
            <Save className="w-3.5 h-3.5" /> Save
          </Button>
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
            <WorkflowStep1UserContext instanceId={openInstance.id} workflowId={openInstance.workflow_type} />
          )}
          {steps[currentStep].id === 'find' && (
            <WorkflowStep2FindResource instanceId={openInstance.id} />
          )}
          {steps[currentStep].id === 'reuse-context' && (
            <WorkflowStep3IntendedUse instanceId={openInstance.id} workflowId={openInstance.workflow_type} />
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
            variant="outline" size="sm" className="gap-1.5"
            onClick={() => setCurrentStep(s => s - 1)}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </Button>
          <span className="text-xs text-muted-foreground">Step {currentStep + 1} of {steps.length}</span>
          <Button
            size="sm" className="gap-1.5"
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workflow</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage workflow instances.</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Workflow
        </Button>
      </div>

      {/* Search + filter */}
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
              variant="outline" size="sm"
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
                <button onClick={() => setTypeFilter([])} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
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

      {/* Cards */}
      {isLoading ? (
        <div className="grid gap-4">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-40 rounded-lg bg-card animate-pulse border border-border/50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title={search || typeFilter.length ? 'No matches' : 'No workflows yet'}
          description={search || typeFilter.length ? 'Try adjusting your search or filter.' : 'Create your first workflow instance to get started.'}
          actionLabel={!search && !typeFilter.length ? 'New Workflow' : undefined}
          onAction={!search && !typeFilter.length ? () => setShowNew(true) : undefined}
        />
      ) : (
        <div className="grid gap-4">
          {filtered.map(inst => (
            <WorkflowCard
              key={inst.id}
              instance={inst}
              onOpen={handleOpen}
              onEdit={(item) => setEditingInstance(item)}
              onClone={(item) => cloneMutation.mutate(item)}
              onDelete={(item) => setDeletingInstance(item)}
            />
          ))}
        </div>
      )}

      {/* New workflow dialog */}
      <WorkflowNewDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreate={(data) => createMutation.mutate(data)}
      />

      {/* Edit dialog */}
      <WorkflowEditDialog
        open={!!editingInstance}
        instance={editingInstance}
        onClose={() => setEditingInstance(null)}
        onSave={(data) => updateMutation.mutate({ id: editingInstance.id, data })}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingInstance} onOpenChange={() => setDeletingInstance(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletingInstance?.name}" will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate(deletingInstance.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}