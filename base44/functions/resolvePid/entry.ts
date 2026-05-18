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
            return Response.json({ 
                error: 'Failed to resolve PID', 
                details: errorText || resolveResponse.statusText 
            }, { status: resolveResponse.status });
        }

        const resolveData = await resolveResponse.json();
        const targetUrl = resolveData.url || resolveData.redirectUrl;
        
        // Fetch the actual metadata from DataCite API
        const metadataUrl = `https://api.datacite.org/dois/${pid}`;
        const metadataResponse = await fetch(metadataUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!metadataResponse.ok) {
            const errorText = await metadataResponse.text();
            return Response.json({ 
                error: 'Failed to fetch metadata', 
                details: errorText || metadataResponse.statusText 
            }, { status: metadataResponse.status });
        }

        const metadataData = await metadataResponse.json();
        
        // DataCite returns metadata in data.attributes
        const fullMetadata = metadataData.data?.attributes || metadataData.attributes || metadataData;
        
        return Response.json({ 
            redirectURL: targetUrl,
            pid: pid,
            metadata: fullMetadata
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});