import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { workflowInstanceId, activeChecklistSourceIds } = await req.json();

        if (!workflowInstanceId || !activeChecklistSourceIds || activeChecklistSourceIds.length === 0) {
            return Response.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // Step 1: Fetch workflow instance
        const workflowInstance = await base44.entities.WorkflowInstance.get(workflowInstanceId);
        if (!workflowInstance) {
            return Response.json({ error: 'Workflow instance not found' }, { status: 404 });
        }

        // Step 2: Get content from Step 2 data
        const step2Data = workflowInstance.step_data?.['step-2'] || workflowInstance.step_data?.['resource'];
        if (!step2Data) {
            return Response.json({ error: 'No resource content found from Step 2' }, { status: 400 });
        }

        let contentToAnalyze = '';
        if (step2Data.input_type === 'url' && step2Data.object_url) {
            // Fetch URL content
            const response = await fetch(step2Data.object_url);
            if (!response.ok) {
                return Response.json({ error: `Failed to fetch URL: ${response.status}` }, { status: 500 });
            }
            contentToAnalyze = await response.text();
        } else if (step2Data.input_type === 'text' && step2Data.text_content) {
            contentToAnalyze = step2Data.text_content;
        } else if (step2Data.input_type === 'file' && step2Data.file_url) {
            // For files, we'll need to fetch the content - this assumes it's text-based
            const response = await fetch(step2Data.file_url);
            if (!response.ok) {
                return Response.json({ error: `Failed to fetch file: ${response.status}` }, { status: 500 });
            }
            contentToAnalyze = await response.text();
        } else {
            return Response.json({ error: 'No valid content found to analyze' }, { status: 400 });
        }

        // Step 3: Fetch checklist sources and their items
        const checklistItems = [];
        for (const checklistSourceId of activeChecklistSourceIds) {
            const checklistSource = await base44.entities.ChecklistSource.get(checklistSourceId);
            if (!checklistSource || !checklistSource.is_active) {
                continue;
            }

            // Call getChecklist backend function to retrieve items
            const checklistResponse = await base44.functions.invoke('getChecklist', {
                checklist_source_id: checklistSourceId
            });

            if (checklistResponse.data && checklistResponse.data.items) {
                checklistItems.push(...checklistResponse.data.items.map(item => ({
                    ...item,
                    checklist_source_id: checklistSourceId,
                    checklist_name: checklistSource.name
                })));
            }
        }

        if (checklistItems.length === 0) {
            return Response.json({ error: 'No checklist items found to analyze' }, { status: 400 });
        }

        // Step 4: Analyze content against each checklist item using LLM
        const analysisResults = [];
        const totalItems = checklistItems.length;
        
        // Chunk content for LLM (max ~8000 chars per chunk to stay within limits)
        const chunkSize = 8000;
        const contentChunks = [];
        for (let i = 0; i < contentToAnalyze.length; i += chunkSize) {
            contentChunks.push(contentToAnalyze.slice(i, i + chunkSize));
        }

        for (let i = 0; i < checklistItems.length; i++) {
            const item = checklistItems[i];
            const itemDescription = item.description || item.label || item.id;

            // Update progress
            const progressData = {
                step3_status: 'in_progress',
                step3_progress: `${i + 1}/${totalItems}`,
                step3_current_item: item.label || item.id,
                step3_total_items: totalItems
            };
            
            await base44.entities.WorkflowInstance.update(workflowInstanceId, {
                step_data: {
                    ...workflowInstance.step_data,
                    'step-3': {
                        ...(workflowInstance.step_data?.['step-3'] || {}),
                        ...progressData
                    }
                }
            });

            // Prepare LLM prompt
            const prompt = `You are analyzing content to determine if it matches a specific checklist item.

CHECKLIST ITEM: "${item.label || item.id}"
DESCRIPTION: "${itemDescription}"

CONTENT TO ANALYZE:
${contentChunks.slice(0, 3).join('\n\n---\n\n')} ${contentChunks.length > 3 ? '(content truncated for analysis)' : ''}

Determine if the content contains information relevant to this checklist item. Return a JSON response with:
{
    "match": boolean,
    "confidence": number (0-100),
    "explanation": string (brief explanation of why it matches or doesn't),
    "matched_snippets": array of strings (exact text snippets that support the match)
}`;

            try {
                const llmResponse = await base44.integrations.Core.InvokeLLM({
                    prompt: prompt,
                    response_json_schema: {
                        type: 'object',
                        properties: {
                            match: { type: 'boolean' },
                            confidence: { type: 'number' },
                            explanation: { type: 'string' },
                            matched_snippets: { 
                                type: 'array', 
                                items: { type: 'string' } 
                            }
                        },
                        required: ['match', 'confidence', 'explanation']
                    }
                });

                analysisResults.push({
                    checklist_item_id: item.id,
                    checklist_item_label: item.label,
                    checklist_source_id: item.checklist_source_id,
                    checklist_name: item.checklist_name,
                    match: llmResponse.data.match,
                    confidence: llmResponse.data.confidence,
                    explanation: llmResponse.data.explanation,
                    matched_snippets: llmResponse.data.matched_snippets || [],
                    analyzed_at: new Date().toISOString()
                });
            } catch (llmError) {
                console.error(`LLM error for item ${item.id}:`, llmError);
                analysisResults.push({
                    checklist_item_id: item.id,
                    checklist_item_label: item.label,
                    checklist_source_id: item.checklist_source_id,
                    checklist_name: item.checklist_name,
                    match: false,
                    confidence: 0,
                    explanation: `Analysis failed: ${llmError.message}`,
                    matched_snippets: [],
                    analyzed_at: new Date().toISOString(),
                    error: true
                });
            }
        }

        // Step 5: Store final results
        const summary = {
            total_items: totalItems,
            matched_items: analysisResults.filter(r => r.match).length,
            high_confidence_matches: analysisResults.filter(r => r.match && r.confidence >= 70).length,
            completed_at: new Date().toISOString()
        };

        await base44.entities.WorkflowInstance.update(workflowInstanceId, {
            step_data: {
                ...workflowInstance.step_data,
                'step-3': {
                    status: 'completed',
                    progress: `${totalItems}/${totalItems}`,
                    analysis_results: analysisResults,
                    summary: summary
                }
            }
        });

        return Response.json({
            success: true,
            message: 'Analysis completed',
            results: analysisResults,
            summary: summary
        });

    } catch (error) {
        console.error('Error in analyzeContentWithChecklists:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});