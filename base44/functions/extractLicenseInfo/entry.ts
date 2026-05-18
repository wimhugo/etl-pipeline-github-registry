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

IMPORTANT: Look for a "rightsList" array in the metadata. If present, extract each item's "rights" and "rightsUri" fields into the rightsList output field.

Priority order for extraction:
1. FIRST: Check for "rightsList" array - extract all items with their "rights" and "rightsUri" fields
2. For license URL: Use "rightsUri" from rightsList items (especially those with "rights" containing license-like terms)
3. For access conditions: Use "rights" text from rightsList items that mention access, restrictions, or terms
4. For usage rights: Use "rights" text from rightsList items that mention permissions or usage
5. Also check other metadata fields for embargo info, dates, or additional context

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
  "rightsList": array of objects with "rights" and "rightsUri" fields (extract directly from metadata if present),
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
                    rightsList: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                rights: { type: "string" },
                                rightsUri: { type: "string" }
                            }
                        }
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
                required: ["license", "accessConditions", "usageRights", "restrictions", "rightsList", "embargoInfo", "confidence"]
            }
        });

        return Response.json(response);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});