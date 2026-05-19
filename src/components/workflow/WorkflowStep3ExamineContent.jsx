import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FileSearch, Loader2, CheckCircle2, AlertCircle, TrendingUp, Quote, ListChecks, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';

export default function WorkflowStep3ExamineContent({ instanceId, workflowId, onComplete }) {
    const [analysisStatus, setAnalysisStatus] = useState(null);
    const [isPolling, setIsPolling] = useState(false);
    const [selectedChecklists, setSelectedChecklists] = useState([]);
    const [refreshKey, setRefreshKey] = useState(0);

    // Fetch active checklist sources
    const { data: checklists = [], isLoading, error, refetch: refetchChecklists } = useQuery({
        queryKey: ['checklist-sources-active'],
        queryFn: () => base44.entities.ChecklistSource.list('-created_date'),
    });

    // Load existing analysis results from workflow instance on mount or when refreshKey changes
    useEffect(() => {
        if (!instanceId) return;
        
        const loadExistingAnalysis = async () => {
            try {
                const instance = await base44.entities.WorkflowInstance.get(instanceId);
                const step3Data = instance.step_data?.['step-3'];
                console.log('Step 3 mount/refresh - step_data:', step3Data);
                if (step3Data && step3Data.analysis_results && step3Data.analysis_results.length > 0) {
                    console.log('Loaded existing analysis results from step-3, matches:', step3Data.analysis_results.filter(r => r.match).length);
                    setAnalysisStatus(step3Data);
                    // Also save to localStorage for backward compatibility
                    localStorage.setItem(`wf_${instanceId}_step-3`, JSON.stringify(step3Data));
                }
            } catch (err) {
                console.error('Failed to load existing analysis:', err);
            }
        };
        
        loadExistingAnalysis();
    }, [instanceId, refreshKey]);

    const activeChecklists = checklists.filter(c => c.is_active);

    // Mutation to trigger analysis
    const analyzeMutation = useMutation({
        mutationFn: async (data) => {
            const response = await base44.functions.invoke('analyzeContentWithChecklists', data);
            return response.data;
        },
        onSuccess: (data) => {
            console.log('Analysis completed successfully:', data);
            setIsPolling(false);
            // Fetch the latest instance data to ensure we have the saved results
            base44.entities.WorkflowInstance.get(instanceId).then(instance => {
                const step3Data = instance.step_data?.['step-3'];
                if (step3Data) {
                    setAnalysisStatus(step3Data);
                    console.log('Updated analysisStatus with saved data:', step3Data);
                }
            }).catch(err => console.error('Failed to fetch updated instance:', err));
            
            if (onComplete) {
                onComplete({ analysisComplete: true, results: data.results, summary: data.summary });
            }
        },
        onError: (error) => {
            setIsPolling(false);
            console.error('Analysis failed:', error);
        }
    });

    // Load saved selections from localStorage (only once on mount)
    useEffect(() => {
        if (activeChecklists.length === 0) return;
        
        const saved = localStorage.getItem(
            instanceId ? `wf_${instanceId}_licence-checklists` : `workflow_${workflowId}_checklists`
        );
        
        let initialSelection = [];
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                initialSelection = parsed.length > 0 ? parsed : [];
            } catch {
                initialSelection = [];
            }
        }
        
        // Auto-select if only one checklist exists and nothing saved
        if (initialSelection.length === 0 && activeChecklists.length === 1) {
            initialSelection = [activeChecklists[0].id];
        }
        
        setSelectedChecklists(initialSelection);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleToggle = (checklistId) => {
        setSelectedChecklists(prev => {
            const updated = prev.includes(checklistId)
                ? prev.filter(id => id !== checklistId)
                : [...prev, checklistId];
            
            // Save to localStorage
            const key = instanceId ? `wf_${instanceId}_licence-checklists` : `workflow_${workflowId}_checklists`;
            localStorage.setItem(key, JSON.stringify(updated));
            
            return updated;
        });
    };

    // Poll for progress updates
    useEffect(() => {
        let pollInterval = null;

        if (isPolling) {
            // Wait 3 seconds before first poll to give backend time to start
            const initialDelay = setTimeout(async () => {
                pollInterval = setInterval(async () => {
                    try {
                        const instance = await base44.entities.WorkflowInstance.get(instanceId);
                        const step3Data = instance.step_data?.['step-3'];
                        
                        if (step3Data) {
                            setAnalysisStatus(step3Data);
                            
                            // Stop polling if completed or errored
                            if (step3Data.status === 'completed' || step3Data.status === 'error') {
                                clearInterval(pollInterval);
                                setIsPolling(false);
                                if (onComplete && step3Data.status === 'completed') {
                                    onComplete({ 
                                        analysisComplete: true, 
                                        results: step3Data.analysis_results, 
                                        summary: step3Data.summary 
                                    });
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Polling error:', error);
                    }
                }, 2000); // Poll every 2 seconds
            }, 3000);
        }

        return () => {
            if (pollInterval) {
                clearInterval(pollInterval);
            }
        };
    }, [isPolling, instanceId, onComplete]);

    const handleStartAnalysis = () => {
        analyzeMutation.mutate({
            workflowInstanceId: instanceId,
            activeChecklistSourceIds: selectedChecklists
        });
        setIsPolling(true);
    };

    if (analyzeMutation.isError) {
        return (
            <Card className="border-destructive/20 bg-destructive/10">
                <CardContent className="p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium text-destructive">Analysis Failed</p>
                        <p className="text-sm text-destructive/80 mt-1">{analyzeMutation.error.message}</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Show progress during analysis
    if (isPolling || analyzeMutation.isPending) {
        const progressPercent = analysisStatus?.progress 
            ? parseInt(analysisStatus.progress.split('/')[0]) / parseInt(analysisStatus.progress.split('/')[1]) * 100
            : 0;

        return (
            <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                        Analyzing Content
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Progress value={progressPercent} className="h-2" />
                    <div className="text-xs text-muted-foreground">
                        {analysisStatus?.progress && (
                            <p>Processing item {analysisStatus.progress}</p>
                        )}
                        {analysisStatus?.step3_current_item && (
                            <p className="mt-1 text-primary/80">
                                Current: {analysisStatus.step3_current_item}
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Show results if analysis is complete
    if (analysisStatus?.status === 'completed' && analysisStatus.analysis_results) {
        const matchedItems = analysisStatus.analysis_results.filter(r => r.match);
        const highConfidenceMatches = matchedItems.filter(r => r.confidence >= 70);

        return (
            <div className="space-y-4">
                {/* Summary Card */}
                <Card className="border-border/50">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-accent" />
                            Analysis Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-foreground">{analysisStatus.summary?.total_items || 0}</p>
                                <p className="text-xs text-muted-foreground">Total Items</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-primary">{matchedItems.length}</p>
                                <p className="text-xs text-muted-foreground">Matched</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-accent">{highConfidenceMatches.length}</p>
                                <p className="text-xs text-muted-foreground">High Confidence</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Matched Items */}
                {matchedItems.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Matched Checklist Items
                        </h4>
                        {matchedItems.map((result, idx) => (
                            <MatchResultCard key={idx} result={result} />
                        ))}
                    </div>
                )}

                {/* Non-matched Items (collapsible) */}
                {analysisStatus.analysis_results.length > matchedItems.length && (
                    <Collapsible>
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                                <ChevronRight className="w-3 h-3 mr-2" />
                                Show Non-Matched Items ({analysisStatus.analysis_results.length - matchedItems.length})
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 pt-2">
                            {analysisStatus.analysis_results
                                .filter(r => !r.match)
                                .map((result, idx) => (
                                    <MatchResultCard key={idx} result={result} />
                                ))}
                        </CollapsibleContent>
                    </Collapsible>
                )}
            </div>
        );
    }

    // Default: Show checklist selection + start button
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
        <div className="space-y-4">
            {/* Intro */}
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Select which checklists to use for evaluating this resource, then click Start Analysis.
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

            {/* Start Analysis button */}
            <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-full bg-primary/10">
                                <FileSearch className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-foreground">Ready to Analyze</p>
                                <p className="text-xs text-muted-foreground">
                                    {selectedChecklists.length} checklist{selectedChecklists.length !== 1 ? 's' : ''} selected
                                </p>
                            </div>
                        </div>
                        <Button 
                            onClick={handleStartAnalysis}
                            disabled={selectedChecklists.length === 0}
                            className="gap-2"
                        >
                            <FileSearch className="w-4 h-4" />
                            Start Analysis
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function MatchResultCard({ result }) {
    const confidenceColor = result.confidence >= 70 ? 'text-accent' 
        : result.confidence >= 40 ? 'text-primary' 
        : 'text-muted-foreground';

    const matchSourceBadge = result.match ? (
        result.match_source === 'regex' ? (
            <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent border-accent/20">
                Regex Match
            </Badge>
        ) : result.match_source === 'llm' ? (
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                AI Analysis
            </Badge>
        ) : null
    ) : null;

    return (
        <Card className={cn(
            "border-border/40",
            result.match && "border-primary/30 bg-primary/5"
        )}>
            <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-foreground">
                                {result.checklist_item_label || result.checklist_item_id}
                            </span>
                            {result.match ? (
                                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                                    <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                                    Match
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                    No Match
                                </Badge>
                            )}
                            {matchSourceBadge}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                            {result.checklist_name}
                        </p>
                    </div>
                    <div className="text-right shrink-0">
                        <p className={cn("text-xs font-bold", confidenceColor)}>
                            {result.confidence}%
                        </p>
                        <p className="text-[9px] text-muted-foreground">Confidence</p>
                    </div>
                </div>
                
                {result.explanation && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {result.explanation}
                    </p>
                )}

                {result.matched_snippets && result.matched_snippets.length > 0 && (
                    <div className="space-y-1">
                        {result.matched_snippets.slice(0, 2).map((snippet, idx) => (
                            <div key={idx} className="flex items-start gap-1.5 text-[10px] text-muted-foreground bg-muted/30 p-1.5 rounded">
                                <Quote className="w-2.5 h-2.5 shrink-0 mt-0.5 text-primary/60" />
                                <span className="italic">{snippet.length > 150 ? snippet.slice(0, 150) + '...' : snippet}</span>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}