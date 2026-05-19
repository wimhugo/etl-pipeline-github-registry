import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import PolicyEditor from '@/components/kbcompose/PolicyEditor';

export default function WorkflowStep5Generate({ instanceId, workflowId, onComplete }) {
    const [showEditor, setShowEditor] = useState(false);
    const [draftPolicy, setDraftPolicy] = useState(null);

    // Fetch the workflow instance to get step 4 selected policies
    const { data: workflowInstance, isLoading: instanceLoading } = useQuery({
        queryKey: ['workflow-instance', instanceId],
        queryFn: () => base44.entities.WorkflowInstance.get(instanceId),
        enabled: !!instanceId,
    });

    // Fetch policies from the KB data files
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

    const { data: fileData, isLoading: policiesLoading } = useQuery({
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

    const { data: actionsData } = useQuery({
        queryKey: ['kbActionsContent', rawBaseUrl, config.kb_sub_entity_files?.actions],
        queryFn: async () => { const r = await fetch(`${rawBaseUrl}/${config.kb_sub_entity_files?.actions}?_=${Date.now()}`); if (!r.ok) throw new Error(); return r.json(); },
        enabled: !!config.kb_sub_entity_files?.actions && !!rawBaseUrl,
        staleTime: 0,
        gcTime: 0,
    });

    const { data: constraintsData } = useQuery({
        queryKey: ['kbConstraintsContent', rawBaseUrl, config.kb_sub_entity_files?.constraints],
        queryFn: async () => { const r = await fetch(`${rawBaseUrl}/${config.kb_sub_entity_files?.constraints}?_=${Date.now()}`); if (!r.ok) throw new Error(); return r.json(); },
        enabled: !!config.kb_sub_entity_files?.constraints && !!rawBaseUrl,
        staleTime: 0,
        gcTime: 0,
    });

    const { data: statesData } = useQuery({
        queryKey: ['kbStatesContent', rawBaseUrl, config.kb_sub_entity_files?.states],
        queryFn: async () => { const r = await fetch(`${rawBaseUrl}/${config.kb_sub_entity_files?.states}?_=${Date.now()}`); if (!r.ok) throw new Error(); return r.json(); },
        enabled: !!config.kb_sub_entity_files?.states && !!rawBaseUrl,
        staleTime: 0,
        gcTime: 0,
    });

    const policies = fileData?.policies || (Array.isArray(fileData) ? fileData : []);
    const policiesMap = Object.fromEntries(policies.map(p => [p.id, p]));

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

    // Get selected policies from step 4 (localStorage or step_data)
    const selectedPolicyIds = useMemo(() => {
        const fromStorage = JSON.parse(localStorage.getItem(`wf_${instanceId}_step-4`) || '{}')?.selected_policies || [];
        const fromStepData = workflowInstance?.step_data?.['step-4']?.selected_policies || [];
        return fromStorage.length > 0 ? fromStorage : fromStepData;
    }, [instanceId, workflowInstance]);

    const selectedPolicies = selectedPolicyIds.map(id => policiesMap[id]).filter(Boolean);

    // Create draft policy and open editor when component mounts
    useEffect(() => {
        if (selectedPolicies.length > 0 && !draftPolicy) {
            const firstPolicy = selectedPolicies[0];
            const newId = `${firstPolicy.id}-draft-${Date.now()}`;
            const draft = {
                ...firstPolicy,
                id: newId,
                label: `${firstPolicy.label} (Draft)`,
                status: 'openrel:status/draft',
                derived_from: firstPolicy.id,
                _createdLocally: Date.now(),
            };
            
            // Save to localStorage as a draft (same as Compose)
            const existingDrafts = JSON.parse(localStorage.getItem('kbcompose_drafts') || '[]');
            localStorage.setItem('kbcompose_drafts', JSON.stringify([...existingDrafts, draft]));
            
            setDraftPolicy(draft);
            setShowEditor(true);
            
            // Notify parent that step 5 is complete with the draft
            if (onComplete) {
                onComplete({
                    draft_policy: draft,
                    status: 'draft',
                });
            }
            
            toast({
                title: "Draft policy created",
                description: `"${draft.label}" is ready for editing.`,
            });
        }
    }, [selectedPolicies, instanceId, onComplete]);

    const handleSaveDraft = (updatedPolicy) => {
        // Update the draft in localStorage (same as Compose)
        const existingDrafts = JSON.parse(localStorage.getItem('kbcompose_drafts') || '[]');
        const updatedDrafts = existingDrafts.map(d => d.id === updatedPolicy.id ? updatedPolicy : d);
        localStorage.setItem('kbcompose_drafts', JSON.stringify(updatedDrafts));
        
        setDraftPolicy(updatedPolicy);
        
        toast({
            title: "Draft policy saved",
            description: `"${updatedPolicy.label}" saved as draft.`,
        });
    };

    const handleCloseEditor = () => {
        setShowEditor(false);
    };

    if (instanceLoading || policiesLoading) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <AlertCircle className="w-4 h-4 animate-spin" /> Loading policy data...
            </div>
        );
    }

    if (!workflowInstance) {
        return (
            <div className="text-sm text-destructive py-4">Workflow instance not found.</div>
        );
    }

    if (selectedPolicies.length === 0) {
        return (
            <Card className="border-border/50 bg-muted/20">
                <CardContent className="p-6 text-center">
                    <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium text-foreground">No Policies Selected</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Please go back to Step 4 and select at least one policy to generate a draft.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Summary */}
            <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        Generate Draft Policy
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-primary">{selectedPolicies.length}</p>
                            <p className="text-xs text-muted-foreground">Selected Policies</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-accent">1</p>
                            <p className="text-xs text-muted-foreground">Draft Policy Created</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Selected policies list */}
            <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Source Policies
                </h4>
                <div className="flex flex-wrap gap-2">
                    {selectedPolicies.map(policy => (
                        <Badge key={policy.id} variant="outline" className="text-xs">
                            {policy.label}
                        </Badge>
                    ))}
                </div>
            </div>

            {/* Policy Editor Dialog */}
            {showEditor && draftPolicy && (
                <PolicyEditor
                    policy={draftPolicy}
                    actionsMap={actionsMap}
                    constraintsMap={constraintsMap}
                    statesMap={statesMap}
                    onSave={handleSaveDraft}
                    onClose={handleCloseEditor}
                />
            )}
        </div>
    );
}