import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);

    // Parse request body first (SDK invoke sends params as POST body)
    let body = {};
    try {
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        const text = await req.text();
        body = text ? JSON.parse(text) : {};
      }
    } catch { /* leave body empty */ }

    // API path: check body first (SDK invoke), then query param, then URL path
    let apiPath = body.api_path || url.searchParams.get('api_path');
    if (!apiPath) {
      const funcSegment = 'apiProxy';
      const idx = url.pathname.lastIndexOf(funcSegment);
      apiPath = idx >= 0 ? url.pathname.substring(idx + funcSegment.length) : url.pathname;
    }
    if (!apiPath.startsWith('/')) apiPath = '/' + apiPath;
    apiPath = apiPath.replace(/\/$/, '') || '/';

    // Method: prefer _method from payload (set by custom fetch plugin),
    // fall back to the actual HTTP method.
    const method = body._method || req.method;
    const queryParams = Object.fromEntries(url.searchParams.entries());
    delete queryParams.api_path;
    delete body._method;
    delete body.api_path;

    // Find matching endpoint
    const endpoints = await base44.asServiceRole.entities.ApiEndpoint.list();
    const active = endpoints.filter(e => e.is_active !== false);

    let matched = null;
    let pathParams = {};

    for (const ep of active) {
      if ((ep.method || 'GET').toUpperCase() !== method.toUpperCase()) continue;
      const epPath = '/' + (ep.path || '').replace(/^\/+/, '').replace(/\/$/, '');
      if (epPath === apiPath) {
        matched = ep;
        break;
      }
      // Template match with {param}
      const template = epPath.replace(/\{[^}]+\}/g, '([^/]+)');
      const regex = new RegExp('^' + template + '$');
      const m = apiPath.match(regex);
      if (m) {
        matched = ep;
        const paramNames = (epPath.match(/\{([^}]+)\}/g) || []).map(p => p.slice(1, -1));
        paramNames.forEach((name, i) => { pathParams[name] = decodeURIComponent(m[i + 1]); });
        break;
      }
    }

    if (!matched) {
      return Response.json({ error: 'No endpoint found', path: apiPath, method }, {
        status: 404,
        headers: corsHeaders,
      });
    }

    if (!matched.target_logic_type) {
      return Response.json({ error: 'Endpoint has no wiring configured', path: apiPath }, {
        status: 501,
        headers: corsHeaders,
      });
    }

    // Merge logic_config with query params and path params
    const payload = { ...(matched.logic_config || {}), ...queryParams, ...pathParams, ...body };

    // Invoke the target function
    const result = await base44.asServiceRole.functions.invoke(matched.target_logic_type, payload);
    const data = result?.data ?? result;

    return Response.json(data, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, {
      status: 500,
      headers: corsHeaders,
    });
  }
});