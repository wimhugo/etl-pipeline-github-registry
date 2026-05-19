import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, AlertCircle, FileText, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';

export default function WorkflowStep5Generate({ instanceId, workflowId, onComplete }) {
    const [draftPolicy, setDraftPolicy] = useState({
        label: '',
        description: '',
        selected_policy_ids: [],
    });
    const [isSaving, setIsSaving] = useState(false);

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

    const policies = fileData?.policies || (Array.isArray(fileData) ? fileData : []);
    const policiesMap = Object.fromEntries(policies.map(p => [p.id, p]));

    // Get selected policies from step 4
    const selectedPolicyIds = workflowInstance?.step_data?.['step-4']?.selected_policies || [];
    const selectedPolicies = selectedPolicyIds.map(id => policiesMap[id]).filter(Boolean);

    // Initialize draft policy from first selected policy (for now)
    useEffect(() => {
        if (selectedPolicies.length > 0 && !draftPolicy.label) {
            const firstPolicy = selectedPolicies[0];
            setDraftPolicy({
                label: `${firstPolicy.label} (Draft)`,
                description: firstPolicy.description || '',
                selected_policy_ids: selectedPolicyIds,
            });
        }
    }, [selectedPolicies]);

    const handleSave = async () => {
        if (!draftPolicy.label.trim()) {
            toast({
                title: "Label required",
                description: "Please provide a label for the draft policy.",
                variant: "destructive",
            });
            return;
        }

        setIsSaving(true);
        try {
            // Save to step_data
            const step5Data = {
                draft_policy: draftPolicy,
                status: 'draft',
            };
            localStorage.setItem(`wf_${instanceId}_step-5`, JSON.stringify(step5Data));
            
            if (onComplete) {
                onComplete(step5Data);
            }

            toast({
                title: "Draft policy saved",
                description: "You can continue editing or submit for review.",
            });
        } catch (error) {
            toast({
                title: "Failed to save",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
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
                            <p className="text-xs text-muted-foreground">Draft Policy</p>
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

            {/* Draft policy editor */}
            <Card className="border-border/50">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Draft Policy Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground">
                            Policy Label *
                        </label>
                        <Input
                            value={draftPolicy.label}
                            onChange={(e) => setDraftPolicy({ ...draftPolicy, label: e.target.value })}
                            placeholder="Enter policy label"
                            className="text-sm"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground">
                            Description
                        </label>
                        <Textarea
                            value={draftPolicy.description}
                            onChange={(e) => setDraftPolicy({ ...draftPolicy, description: e.target.value })}
                            placeholder="Enter policy description"
                            className="text-sm min-h-[100px]"
                        />
                    </div>

                    <div className="pt-2 flex justify-end">
                        <Button 
                            onClick={handleSave} 
                            className="gap-2"
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <AlertCircle className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save Draft
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}