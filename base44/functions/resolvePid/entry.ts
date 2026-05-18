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

        const url = `https://api.pidmr.argo.grnet.gr/v1/metaresolvers/resolve?pid=${encodeURIComponent(pid)}&pidmode=metadata&format=json`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            return Response.json({ 
                error: 'Failed to resolve PID', 
                details: errorText || response.statusText 
            }, { status: response.status });
        }

        const data = await response.json();
        
        return Response.json({ 
            redirectURL: data.url,
            pid: data.pid,
            metadata: data
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});