import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ListChecks, Loader2, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';

export default function WorkflowStep3ChecklistSelection({ instanceId, workflowId, onComplete }) {
  const [selectedChecklists, setSelectedChecklists] = useState([]);

  // Fetch active checklist sources
  const { data: checklists = [], isLoading, error } = useQuery({
    queryKey: ['checklist-sources-active'],
    queryFn: () => base44.entities.ChecklistSource.list('-created_date'),
  });

  const activeChecklists = checklists.filter(c => c.is_active);

  // Load saved selections from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(
      instanceId ? `wf_${instanceId}_licence-checklists` : `workflow_${workflowId}_checklists`
    );
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Auto-select single checklist if only one exists
        if (parsed.length === 0 && activeChecklists.length === 1) {
          setSelectedChecklists([activeChecklists[0].id]);
        } else {
          setSelectedChecklists(parsed);
        }
      } catch (e) {
        console.error('Failed to parse saved checklists:', e);
      }
    } else if (activeChecklists.length === 1) {
      // Auto-select single checklist by default
      setSelectedChecklists([activeChecklists[0].id]);
    }
  }, [activeChecklists]);

  const handleToggle = (checklistId) => {
    setSelectedChecklists(prev => {
      const updated = prev.includes(checklistId)
        ? prev.filter(id => id !== checklistId)
        : [...prev, checklistId];
      
      // Save to localStorage
      const key = instanceId ? `wf_${instanceId}_licence-checklists` : `workflow_${workflowId}_checklists`;
      localStorage.setItem(key, JSON.stringify(updated));
      
      // Notify parent
      if (onComplete) {
        onComplete({ selectedChecklists: updated });
      }
      
      return updated;
    });
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border/50 p-4 flex items-center gap-3 bg-muted/30">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium">Loading available checklists...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 p-4 flex items-start gap-3 bg-destructive/10">
        <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div className="text-sm text-destructive">
          <p className="font-medium">Failed to load checklists</p>
          <p className="text-xs mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  if (activeChecklists.length === 0) {
    return (
      <div className="rounded-lg border border-border/40 p-4 flex items-start gap-3 bg-muted/30">
        <ListChecks className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium">No checklists available</p>
          <p className="text-xs mt-1">
            No active checklists found in the Checklist Manager. Please configure at least one checklist source.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Intro */}
      <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Select which checklists to use for evaluating this resource. Your selections are saved automatically.
        </p>
      </div>

      {/* Summary */}
      {selectedChecklists.length > 0 && (
        <Card className="bg-card border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-xs font-medium text-muted-foreground">
                Active checklists:
              </Label>
              {selectedChecklists.map(id => {
                const checklist = activeChecklists.find(c => c.id === id);
                return checklist ? (
                  <Badge key={id} variant="outline" className="text-xs">
                    {checklist.name}
                  </Badge>
                ) : null;
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Checklist list */}
      <div className="space-y-2">
        {activeChecklists.map((checklist) => (
          <label
            key={checklist.id}
            className="flex items-center justify-between p-3 rounded-lg border border-border/40 hover:bg-muted/20 transition-colors cursor-pointer group"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                  {checklist.name}
                </span>
                {checklist.description && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {checklist.source_type}
                  </Badge>
                )}
              </div>
              {checklist.description && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {checklist.description}
                </p>
              )}
            </div>
            <Switch
              checked={selectedChecklists.includes(checklist.id)}
              onCheckedChange={() => handleToggle(checklist.id)}
              className="shrink-0 ml-3"
            />
          </label>
        ))}
      </div>

      {/* Clear all */}
      {selectedChecklists.length > 0 && (
        <div className="flex items-center justify-end pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedChecklists([]);
              const key = instanceId ? `wf_${instanceId}_licence-checklists` : `workflow_${workflowId}_checklists`;
              localStorage.removeItem(key);
              if (onComplete) {
                onComplete({ selectedChecklists: [] });
              }
              toast({
                title: 'Checklists cleared',
                description: 'All checklist selections have been cleared.',
              });
            }}
            className="h-8 text-xs"
          >
            Clear All
          </Button>
        </div>
      )}
    </div>
  );
}