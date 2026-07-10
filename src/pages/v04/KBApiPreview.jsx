import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Eye, ExternalLink } from 'lucide-react';
import { generateSwaggerSpec } from '@/lib/swaggerSpec';

export default function KBApiPreview() {
  const [serverUrl, setServerUrl] = useState(
    `${appParams.appBaseUrl || ''}/functions/apiProxy`
  );

  const { data: endpoints = [] } = useQuery({
    queryKey: ['apiEndpoints'],
    queryFn: () => base44.entities.ApiEndpoint.list('-sort_order'),
  });

  const spec = useMemo(
    () => generateSwaggerSpec(endpoints, { serverUrl }),
    [endpoints, serverUrl]
  );

  const blobUrl = useMemo(() => {
    const specJson = JSON.stringify(spec).replace(/</g, '\\u003c');
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css">
  <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js"></script>
  <style>
    body { margin: 0; background: hsl(222 47% 11%); }
    .swagger-ui { background: hsl(222 47% 11%); }
    .swagger-ui .opblock-tag, .swagger-ui .opblock-tag-small { color: hsl(210 40% 98%); }
    .swagger-ui .info .title, .swagger-ui .info .baseurl { color: hsl(210 40% 98%); }
    .swagger-ui .info .description p { color: hsl(215 20% 65%); }
    .swagger-ui .scheme-container { background: hsl(222 47% 13%); }
    .swagger-ui .opblock { border: 1px solid hsl(217 33% 25%); background: hsl(217 33% 17%); }
    .swagger-ui .opblock .opblock-summary-method { color: hsl(0 0% 100%); }
    .swagger-ui .opblock .opblock-summary-path, .swagger-ui .opblock .opblock-summary-description { color: hsl(210 40% 98%); }
    .swagger-ui .parameters-col_description, .swagger-ui .parameter__name, .swagger-ui table thead tr td, .swagger-ui table thead tr th { color: hsl(210 40% 98%); }
    .swagger-ui table .parameters-col_name { color: hsl(210 40% 98%); }
    .swagger-ui .responses-inner, .swagger-ui .responses-wrapper, .swagger-ui .opblock-body { color: hsl(210 40% 98%); }
    .swagger-ui .opblock-body pre, .swagger-ui .opblock-body .microlight { background: hsl(222 47% 9%); color: hsl(160 84% 70%); }
    .swagger-ui section.models { background: hsl(217 33% 17%); }
    .swagger-ui section.models h4, .swagger-ui section.models .model-title { color: hsl(210 40% 98%); }
    .swagger-ui .model-box { background: hsl(222 47% 9%); }
    .swagger-ui .btn { border-color: hsl(217 33% 25%); }
    .swagger-ui .btn.authorize, .swagger-ui .btn.try-out { background: hsl(217 91% 60%); color: hsl(222 47% 11%); }
    .swagger-ui input[type=text], .swagger-ui textarea { background: hsl(222 47% 9%); color: hsl(210 40% 98%); border-color: hsl(217 33% 25%); }
    .swagger-ui select { background: hsl(222 47% 9%); color: hsl(210 40% 98%); }
    .swagger-ui .loading-container { background: hsl(222 47% 11%); }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        dom_id: '#swagger-ui',
        spec: ${specJson},
        presets: [SwaggerUIBundle.presets.apis],
        layout: 'BaseLayout',
        deepLinking: true,
      });
    };
  </script>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [spec]);

  useEffect(() => {
    return () => URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

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
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <ExternalLink className="w-4 h-4" /> Server URL
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={serverUrl}
            onChange={e => setServerUrl(e.target.value)}
            placeholder="https://backend-api.base44.com/apps/{app-id}/functions/apiProxy"
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Set this to the <span className="font-mono">apiProxy</span> function endpoint URL
            (Dashboard → Code → Functions → apiProxy) to enable "Try it out" with live requests.
          </p>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border overflow-hidden">
        <iframe
          src={blobUrl}
          className="w-full border-0"
          style={{ height: '70vh', minHeight: '500px' }}
          title="Swagger UI Preview"
        />
      </div>
    </div>
  );
}