import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { metadata } = await req.json();
        
        if (!metadata || typeof metadata !== 'object') {
            return Response.json({ error: 'Metadata is required and must be an object' }, { status: 400 });
        }

        const prompt = `Analyze the following JSON metadata and extract any license, access conditions, or rights information.

Metadata:
${JSON.stringify(metadata, null, 2)}

Identify:
1. License information (name, URL, type)
2. Access conditions or restrictions
3. Usage rights or permissions
4. Any embargo or time-based restrictions

Return ONLY a JSON object with this exact structure:
{
  "license": {
    "name": string | null,
    "url": string | null,
    "type": string | null
  },
  "accessConditions": string | null,
  "usageRights": string | null,
  "restrictions": string[] | [],
  "embargoInfo": {
    "hasEmbargo": boolean,
    "embargoDate": string | null,
    "embargoReason": string | null
  },
  "confidence": "high" | "medium" | "low",
  "notes": string | null
}`;

        const response = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
            response_json_schema: {
                type: "object",
                properties: {
                    license: {
                        type: "object",
                        properties: {
                            name: { type: "string" },
                            url: { type: "string" },
                            type: { type: "string" }
                        }
                    },
                    accessConditions: { type: "string" },
                    usageRights: { type: "string" },
                    restrictions: {
                        type: "array",
                        items: { type: "string" }
                    },
                    embargoInfo: {
                        type: "object",
                        properties: {
                            hasEmbargo: { type: "boolean" },
                            embargoDate: { type: "string" },
                            embargoReason: { type: "string" }
                        }
                    },
                    confidence: {
                        type: "string",
                        enum: ["high", "medium", "low"]
                    },
                    notes: { type: "string" }
                },
                required: ["license", "accessConditions", "usageRights", "restrictions", "embargoInfo", "confidence"]
            }
        });

        return Response.json(response);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});