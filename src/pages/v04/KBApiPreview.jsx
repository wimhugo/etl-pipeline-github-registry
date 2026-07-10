import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Eye } from 'lucide-react';
import { generateSwaggerSpec } from '@/lib/swaggerSpec';
import SwaggerUiContainer from '@/components/kbapi/SwaggerUiContainer';

// Display-only server URL shown in the Swagger spec (requests are
// actually routed through the SDK via the custom fetch plugin below).
const DISPLAY_SERVER_URL = 'https://api.openrel.org/v0.4';

/**
 * Swagger UI plugin that intercepts "Try it out" requests and routes them
 * through the Base44 SDK (base44.functions.invoke) instead of making direct
 * HTTP calls. This avoids CORS, auth-header, and URL-routing issues.
 */
function createApiProxyPlugin() {
  return {
    fn: {
      fetch: async (url, options = {}) => {
        try {
          const parsedUrl = new URL(url, window.location.origin);
          // The API path is everything after the display server URL's pathname
          let apiPath = parsedUrl.pathname;
          if (!apiPath.startsWith('/')) apiPath = '/' + apiPath;
          apiPath = apiPath.replace(/\/$/, '') || '/';

          // Collect query parameters (excluding internal ones)
          const params = {};
          parsedUrl.searchParams.forEach((value, key) => {
            params[key] = value;
          });

          // Route through the SDK — the platform handles auth and routing
          try {
            const result = await base44.functions.invoke('apiProxy', {
              api_path: apiPath,
              _method: (options.method || 'GET').toUpperCase(),
              ...params,
            });
            const data = result?.data ?? result;
            return new Response(JSON.stringify(data), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          } catch (err) {
            const status = err?.response?.status || 500;
            const errorData = err?.response?.data || { error: err.message };
            return new Response(JSON.stringify(errorData), {
              status,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },
  };
}

export default function KBApiPreview() {
  const { data: endpoints = [] } = useQuery({
    queryKey: ['apiEndpoints'],
    queryFn: () => base44.entities.ApiEndpoint.list('-sort_order'),
  });

  const spec = useMemo(
    () => generateSwaggerSpec(endpoints, { serverUrl: DISPLAY_SERVER_URL }),
    [endpoints]
  );

  const plugins = useMemo(() => [createApiProxyPlugin()], []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Eye className="w-6 h-6 text-primary" />
          API Preview
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Interactive Swagger UI preview of your API definition. Expand an endpoint and click "Try it out" to send a live request.
        </p>
      </div>

      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">
            How it works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            "Try it out" requests are routed securely through the Base44 SDK to the
            <span className="font-mono text-foreground"> apiProxy </span>
            backend function, which dispatches each call to its wired logic handler.
            The server URL shown in the spec (<span className="font-mono">{DISPLAY_SERVER_URL}</span>) is for display only.
          </p>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <SwaggerUiContainer spec={spec} plugins={plugins} />
      </div>
    </div>
  );
}