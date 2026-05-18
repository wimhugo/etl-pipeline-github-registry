import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { pid } = await req.json();
        
        if (!pid) {
            return Response.json({ error: 'PID is required' }, { status: 400 });
        }

        // First, resolve the PID to get the target URL
        const resolveUrl = `https://api.pidmr.argo.grnet.gr/v1/metaresolvers/resolve?pid=${encodeURIComponent(pid)}&pidmode=metadata&format=json`;
        
        const resolveResponse = await fetch(resolveUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!resolveResponse.ok) {
            const errorText = await resolveResponse.text();
            let errorMessage = errorText || resolveResponse.statusText;
            
            // Try to parse as JSON to extract human-readable message
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.message) {
                    errorMessage = errorJson.message;
                }
            } catch {
                // Not JSON, use the raw text
            }
            
            return Response.json({ 
                error: 'Failed to resolve PID', 
                message: errorMessage 
            }, { status: resolveResponse.status });
        }

        const resolveData = await resolveResponse.json();
        
        const targetUrl = resolveData.url || resolveData.redirectUrl;
        const metadata = resolveData.metadata || resolveData;
        
        return Response.json({ 
            redirectURL: targetUrl,
            pid: pid,
            metadata: metadata
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});