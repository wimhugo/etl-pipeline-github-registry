import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, AlertCircle, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PolicyCard from '@/components/kbsearch/PolicyCard';
import { toast } from '@/components/ui/use-toast';

export default function WorkflowStep4Review({ instanceId, workflowId, onComplete }) {
    const [selectedPolicies, setSelectedPolicies] = useState([]);

    // Fetch the workflow instance to get step 3 analysis results
    const { data: workflowInstance, isLoading: instanceLoading } = useQuery({
        queryKey: ['workflow-instance', instanceId],
        queryFn: () => base44.entities.WorkflowInstance.get(instanceId),
        enabled: !!instanceId,
    });

    // Fetch active checklist sources
    const { data: checklists = [], isLoading: checklistsLoading } = useQuery({
        queryKey: ['checklist-sources-active'],
        queryFn: () => base44.entities.ChecklistSource.list('-created_date'),
    });

    // Get analysis results from step 3
    const analysisResults = workflowInstance?.step_data?.['step-3']?.analysis_results || [];
    const matchedItems = analysisResults.filter(r => r.match);

    // Get unique checklist IDs that had matches
    const matchedChecklistIds = useMemo(() => {
        const ids = new Set(matchedItems.map(r => r.checklist_source_id));
        return Array.from(ids);
    }, [matchedItems]);

    // Get checklists that had matches
    const matchedChecklists = checklists.filter(c => matchedChecklistIds.includes(c.id));

    // Collect all recommended policies from matched checklists
    const recommendedPolicyIds = useMemo(() => {
        const policySet = new Set();
        matchedChecklists.forEach(checklist => {
            if (checklist.recommended_policies && Array.isArray(checklist.recommended_policies)) {
                checklist.recommended_policies.forEach(pid => policySet.add(pid));
            }
        });
        return Array.from(policySet);
    }, [matchedChecklists]);

    // Fetch policies from the KB data files (same as KBPolicyList)
    const { data: globalConfigs = [] } = useQuery({
        queryKey: ['globalConfig'],
        queryFn: () => base44.entities.GlobalConfig.list(),
    });
    const config = globalConfigs[0] || {};
    const apiUrl = (config.kb_search_data_api_url || '').replace(/\?ref=[^&]*/, '');
    const rawBaseUrl = config.kb_search_data_url || '';

    const { data: fileList = [] } = useQuery({
        queryKey: ['kbSearchFiles', apiUrl],
        queryFn: async () => { const r = await fetch(apiUrl); if (!r.ok) throw new Error(); return r.json(); },
        enabled: !!apiUrl,
    });
    const jsonFiles = fileList.filter(f => f.name?.toLowerCase().endsWith('.json'));
    const autoPolicy = jsonFiles.find(f => f.name.toLowerCase().includes('polic'))?.name || '';
    const policyFile = config.kb_policy_file || autoPolicy;

    const autoActionsFile = jsonFiles.find(f => f.name.toLowerCase().includes('action'))?.name || '';
    const actionsFile = config.kb_sub_entity_files?.actions || autoActionsFile;

    const autoConstraintsFile = jsonFiles.find(f => f.name.toLowerCase().includes('constraint'))?.name || '';
    const constraintsFile = config.kb_sub_entity_files?.constraints || autoConstraintsFile;

    const autoStatesFile = jsonFiles.find(f => f.name.toLowerCase().includes('state'))?.name || '';
    const statesFile = config.kb_sub_entity_files?.states || autoStatesFile;

    const { data: actionsData } = useQuery({
        queryKey: ['kbActionsContent', rawBaseUrl, actionsFile],
        queryFn: async () => { const r = await fetch(`${rawBaseUrl}/${actionsFile}`); if (!r.ok) throw new Error(); return r.json(); },
        enabled: !!actionsFile && !!rawBaseUrl,
    });

    const { data: constraintsData } = useQuery({
        queryKey: ['kbConstraintsContent', rawBaseUrl, constraintsFile],
        queryFn: async () => { const r = await fetch(`${rawBaseUrl}/${constraintsFile}`); if (!r.ok) throw new Error(); return r.json(); },
        enabled: !!constraintsFile && !!rawBaseUrl,
    });

    const { data: statesData } = useQuery({
        queryKey: ['kbStatesContent', rawBaseUrl, statesFile],
        queryFn: async () => { const r = await fetch(`${rawBaseUrl}/${statesFile}`); if (!r.ok) throw new Error(); return r.json(); },
        enabled: !!statesFile && !!rawBaseUrl,
    });

    const { data: fileData, isLoading: policiesLoading, error } = useQuery({
        queryKey: ['kbFileContent', rawBaseUrl, policyFile],
        queryFn: async () => {
            const r = await fetch(`${rawBaseUrl}/${policyFile}?_=${Date.now()}`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        },
        enabled: !!policyFile && !!rawBaseUrl,
        staleTime: 0,
        gcTime: 0,
    });

    const actionsArray = Array.isArray(actionsData) ? actionsData : (actionsData?.actions || []);
    const actionsMap = Object.fromEntries(actionsArray.map(a => [a.id, a]));

    const constraintsArray = Array.isArray(constraintsData) ? constraintsData : (constraintsData?.constraints || []);
    const constraintsMap = Object.fromEntries(constraintsArray.map(c => [c.id, c]));

    const statesArray = Array.isArray(statesData) ? statesData : (statesData?.states || []);
    const statesMap = statesArray.reduce((acc, s) => {
        if (s.id) {
            acc[s.id] = s;
            const shortKey = s.id.split(/[:/]/).pop()?.toLowerCase();
            if (shortKey && shortKey !== s.id) acc[shortKey] = s;
        }
        return acc;
    }, {});

    const policies = fileData?.policies || (Array.isArray(fileData) ? fileData : []);
    const policiesMap = Object.fromEntries(policies.map(p => [p.id, p]));

    // Filter to only show recommended policies
    const recommendedPolicies = policies.filter(p => recommendedPolicyIds.includes(p.id));

    const handleContinue = () => {
        if (onComplete) {
            onComplete({ selectedPolicies });
        }
    };

    if (instanceLoading || checklistsLoading) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <AlertCircle className="w-4 h-4 animate-spin" /> Loading review data...
            </div>
        );
    }

    if (!workflowInstance) {
        return (
            <div className="text-sm text-destructive py-4">Workflow instance not found.</div>
        );
    }

    if (analysisResults.length === 0) {
        return (
            <Card className="border-border/50 bg-muted/20">
                <CardContent className="p-6 text-center">
                    <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium text-foreground">No Analysis Results</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Please complete the content analysis in Step 3 before reviewing policies.
                    </p>
                </CardContent>
            </Card>
        );
    }

    if (matchedItems.length === 0) {
        return (
            <Card className="border-border/50 bg-muted/20">
                <CardContent className="p-6 text-center">
                    <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium text-foreground">No Matches Found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        No checklist items matched your content. No policies are recommended.
                    </p>
                </CardContent>
            </Card>
        );
    }

    if (recommendedPolicyIds.length === 0) {
        return (
            <Card className="border-border/50 bg-muted/20">
                <CardContent className="p-6 text-center">
                    <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium text-foreground">No Recommended Policies</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        The matched checklist items don't have any associated policies.
                    </p>
                </CardContent>
            </Card>
        );
    }

    if (policiesLoading) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <AlertCircle className="w-4 h-4 animate-spin" /> Loading policies...
            </div>
        );
    }

    if (error) {
        return <div className="text-sm text-destructive py-4">Failed to load policies: {error.message}</div>;
    }

    return (
        <div className="space-y-4">
            {/* Summary */}
            <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        Recommended Policies
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-foreground">{matchedChecklists.length}</p>
                            <p className="text-xs text-muted-foreground">Matched Checklists</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-primary">{recommendedPolicyIds.length}</p>
                            <p className="text-xs text-muted-foreground">Recommended Policies</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-accent">{matchedItems.length}</p>
                            <p className="text-xs text-muted-foreground">Total Matches</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Matched checklists */}
            <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Matched Checklists
                </h4>
                <div className="flex flex-wrap gap-2">
                    {matchedChecklists.map(checklist => (
                        <Badge key={checklist.id} variant="outline" className="text-xs">
                            {checklist.name}
                        </Badge>
                    ))}
                </div>
            </div>

            {/* Policy list */}
            <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Policies ({recommendedPolicies.length})
                </h4>
                {recommendedPolicies.map(policy => (
                    <PolicyCard 
                        key={policy.id} 
                        policy={policy} 
                        actionsMap={actionsMap} 
                        constraintsMap={constraintsMap} 
                        statesMap={statesMap} 
                        policiesMap={policiesMap} 
                    />
                ))}
            </div>

            {/* Continue button */}
            <div className="flex justify-end pt-2">
                <Button onClick={handleContinue} className="gap-2">
                    Continue
                    <CheckCircle2 className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}