import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FileSearch, Loader2, CheckCircle2, AlertCircle, TrendingUp, Quote, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WorkflowStep3ExamineContent({ instanceId, workflowId, onComplete }) {
    const [analysisStatus, setAnalysisStatus] = useState(null);
    const [isPolling, setIsPolling] = useState(false);

    // Fetch active checklist sources
    const { data: checklists = [] } = useQuery({
        queryKey: ['checklist-sources-active'],
        queryFn: () => base44.entities.ChecklistSource.list('-created_date'),
    });

    const activeChecklists = checklists.filter(c => c.is_active);

    // Mutation to trigger analysis
    const analyzeMutation = useMutation({
        mutationFn: async (data) => {
            const response = await base44.functions.invoke('analyzeContentWithChecklists', data);
            return response.data;
        },
        onSuccess: (data) => {
            setIsPolling(false);
            if (onComplete) {
                onComplete({ analysisComplete: true, results: data.results, summary: data.summary });
            }
        },
        onError: (error) => {
            setIsPolling(false);
            console.error('Analysis failed:', error);
        }
    });

    // Poll for progress updates
    useEffect(() => {
        let pollInterval = null;

        if (isPolling) {
            pollInterval = setInterval(async () => {
                try {
                    const instance = await base44.entities.WorkflowInstance.get(instanceId);
                    const step3Data = instance.step_data?.['step-3'];
                    
                    if (step3Data) {
                        setAnalysisStatus(step3Data);
                        
                        // Stop polling if completed or errored
                        if (step3Data.status === 'completed' || step3Data.status === 'error') {
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
            activeChecklistSourceIds: [] // Will be populated from parent or localStorage
        });
        setIsPolling(true);
    };

    // Load saved checklist selections
    const getSelectedChecklists = () => {
        const saved = localStorage.getItem(
            instanceId ? `wf_${instanceId}_licence-checklists` : `workflow_${workflowId}_checklists`
        );
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                return [];
            }
        }
        // Auto-select single checklist if only one exists
        if (activeChecklists.length === 1) {
            return [activeChecklists[0].id];
        }
        return [];
    };

    const selectedChecklists = getSelectedChecklists();

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

    // Default: Show start button
    return (
        <Card className="border-border/50">
            <CardContent className="p-6 text-center space-y-4">
                <div className="flex justify-center">
                    <div className="p-3 rounded-full bg-primary/10">
                        <FileSearch className="w-8 h-8 text-primary" />
                    </div>
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-foreground">Ready to Analyze</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                        {selectedChecklists.length} checklist{selectedChecklists.length !== 1 ? 's' : ''} selected. Click below to start analysis.
                    </p>
                </div>
                {selectedChecklists.length > 0 && (
                    <div className="flex flex-wrap gap-1 justify-center mb-2">
                        {selectedChecklists.map(id => {
                            const checklist = activeChecklists.find(c => c.id === id);
                            return checklist ? (
                                <Badge key={id} variant="outline" className="text-xs">
                                    {checklist.name}
                                </Badge>
                            ) : null;
                        })}
                    </div>
                )}
                <Button 
                    onClick={handleStartAnalysis}
                    disabled={selectedChecklists.length === 0}
                    className="gap-2"
                >
                    <FileSearch className="w-4 h-4" />
                    Start Analysis
                </Button>
                {selectedChecklists.length === 0 && activeChecklists.length === 0 && (
                    <p className="text-xs text-destructive">
                        No active checklists available. Please configure checklists in the Checklist Manager.
                    </p>
                )}
                {selectedChecklists.length === 0 && activeChecklists.length > 1 && (
                    <p className="text-xs text-muted-foreground">
                        Please go back to select which checklists to use.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

function MatchResultCard({ result }) {
    const confidenceColor = result.confidence >= 70 ? 'text-accent' 
        : result.confidence >= 40 ? 'text-primary' 
        : 'text-muted-foreground';

    return (
        <Card className={cn(
            "border-border/40",
            result.match && "border-primary/30 bg-primary/5"
        )}>
            <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
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