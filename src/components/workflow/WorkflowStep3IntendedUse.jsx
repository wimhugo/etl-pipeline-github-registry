import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FileJson, ChevronDown, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { getColourClass } from '@/components/kbuser/BadgeMappingTable';

export default function WorkflowStep3IntendedUse({ workflowId, onComplete }) {
  const [selectedUses, setSelectedUses] = useState([]);

  // Fetch badge mappings from GlobalConfig
  const { data: globalConfigs = [] } = useQuery({
    queryKey: ['globalConfig'],
    queryFn: () => base44.entities.GlobalConfig.list(),
  });
  const globalConfig = globalConfigs[0];
  const badgeMappings = globalConfig?.badge_mappings || [];

  // Fetch badge mapping file content from GitHub if available
  const { data: badgeMappingFileContent, isLoading: fileLoading, error: fileError } = useQuery({
    queryKey: ['badgeMappingFile', globalConfig?.badge_mapping_file],
    queryFn: async () => {
      if (!globalConfig?.badge_mapping_file || !globalConfig?.kb_search_data_url) {
        return null;
      }
      
      // Try to fetch from GitHub raw URL
      const rawUrl = `${globalConfig.kb_search_data_url}/${globalConfig.badge_mapping_file}`;
      const res = await fetch(rawUrl);
      if (!res.ok) {
        throw new Error('Failed to fetch badge mapping file');
      }
      return await res.text();
    },
    enabled: !!globalConfig?.badge_mapping_file && !!globalConfig?.kb_search_data_url,
  });

  // Load saved selections from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`workflow_${workflowId}_intendedUses`);
    if (saved) {
      try {
        setSelectedUses(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved intended uses:', e);
      }
    }
  }, [workflowId]);

  const handleToggle = (useKey) => {
    setSelectedUses(prev => {
      const updated = prev.includes(useKey)
        ? prev.filter(k => k !== useKey)
        : [...prev, useKey];
      
      // Save to localStorage
      localStorage.setItem(`workflow_${workflowId}_intendedUses`, JSON.stringify(updated));
      
      // Notify parent of completion if needed
      if (onComplete) {
        onComplete({ intendedUses: updated });
      }
      
      return updated;
    });
  };

  // Extract unique constraint mappings from badge mappings
  const availableConstraints = useMemo(() => {
    const constraints = new Set();
    badgeMappings.forEach(mapping => {
      if (mapping.constraintMapping) {
        mapping.constraintMapping.split(',').forEach(c => {
          const trimmed = c.trim();
          if (trimmed) constraints.add(trimmed);
        });
      }
    });
    return Array.from(constraints).sort();
  }, [badgeMappings]);

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileJson className="w-4 h-4 text-primary" />
            Intended Use
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select the intended use(s) for this resource based on your verified context badges.
          </p>

          {availableConstraints.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border/40">
              <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium">No constraint mappings available</p>
                <p className="text-xs mt-1">
                  Please configure badge mappings in KB User Configuration first.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Available Uses</Label>
                <Badge variant="outline">{selectedUses.length} selected</Badge>
              </div>
              
              <div className="grid gap-3">
                {availableConstraints.map(constraint => (
                  <div
                    key={constraint}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                      selectedUses.includes(constraint)
                        ? "bg-primary/10 border-primary/40"
                        : "bg-muted/20 border-border/40 hover:bg-muted/30"
                    )}
                    onClick={() => handleToggle(constraint)}
                  >
                    <Checkbox
                      checked={selectedUses.includes(constraint)}
                      onCheckedChange={() => handleToggle(constraint)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <Label className="text-sm font-medium text-foreground cursor-pointer">
                        {constraint.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        {badgeMappings
                          .filter(m => m.constraintMapping?.includes(constraint))
                          .map(m => m.profileBadge)
                          .join(', ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Collapsible Badge Mapping File Preview */}
          {globalConfig?.badge_mapping_file && (
            <Collapsible className="mt-6">
              <div className="flex items-center gap-2 mb-2">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                    <ChevronDown className="w-3 h-3" />
                    <FileJson className="w-3 h-3" />
                    {globalConfig.badge_mapping_file}
                  </Button>
                </CollapsibleTrigger>
                {fileLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
              </div>
              <CollapsibleContent>
                <div className="rounded-lg border border-border/40 bg-muted/30 overflow-hidden">
                  {fileError ? (
                    <div className="p-3 text-xs text-destructive">
                      <AlertCircle className="w-3 h-3 inline mr-1" />
                      Failed to load file: {fileError.message}
                    </div>
                  ) : badgeMappingFileContent ? (
                    <pre className="p-3 text-xs font-mono text-foreground overflow-x-auto max-h-64 overflow-y-auto">
                      {badgeMappingFileContent}
                    </pre>
                  ) : (
                    <div className="p-3 text-xs text-muted-foreground italic">
                      File not yet pushed to GitHub. Save mappings first.
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>
    </div>
  );
}