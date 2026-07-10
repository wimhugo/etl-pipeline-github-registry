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

  const iframeHtml = useMemo(() => {
    const specJson = JSON.stringify(spec);
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css">
<style>
body{margin:0;background:#0f172a}
.swagger-ui{background:#0f172a}
.swagger-ui .opblock-tag,.swagger-ui .opblock-tag-small{color:#f8fafc}
.swagger-ui .info .title,.swagger-ui .info .baseurl{color:#f8fafc}
.swagger-ui .info .description p{color:#94a3b8}
.swagger-ui .scheme-container{background:#1e293b}
.swagger-ui .opblock{border:1px solid #334155;background:#1e293b}
.swagger-ui .opblock .opblock-summary-method{color:#fff}
.swagger-ui .opblock .opblock-summary-path,.swagger-ui .opblock .opblock-summary-description{color:#f8fafc}
.swagger-ui .parameters-col_description,.swagger-ui .parameter__name,.swagger-ui table thead tr td,.swagger-ui table thead tr th{color:#f8fafc}
.swagger-ui table .parameters-col_name{color:#f8fafc}
.swagger-ui .responses-inner,.swagger-ui .responses-wrapper,.swagger-ui .opblock-body{color:#f8fafc}
.swagger-ui .opblock-body pre,.swagger-ui .opblock-body .microlight{background:#0f172a;color:#4ade80}
.swagger-ui section.models{background:#1e293b}
.swagger-ui section.models h4,.swagger-ui section.models .model-title{color:#f8fafc}
.swagger-ui .model-box{background:#0f172a}
.swagger-ui .btn{border-color:#334155}
.swagger-ui .btn.authorize,.swagger-ui .btn.try-out{background:#3b82f6;color:#0f172a}
.swagger-ui input[type=text],.swagger-ui textarea{background:#0f172a;color:#f8fafc;border-color:#334155}
.swagger-ui select{background:#0f172a;color:#f8fafc}
.swagger-ui .loading-container{background:#0f172a}
.swagger-ui .download-contents,.swagger-ui .download-url-button{background:#3b82f6;color:#0f172a}
</style>
</head>
<body>
<div id="swagger-ui"></div>
<script>
var script=document.createElement('script');
script.src='https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js';
script.onload=function(){
window.ui=SwaggerUIBundle({
dom_id:'#swagger-ui',
spec:${specJson},
presets:[SwaggerUIBundle.presets.apis],
deepLinking:true,
supportedSubmitMethods:['get','post','put','delete','patch']
});
};
document.head.appendChild(script);
</script>
</body>
</html>`;
  }, [spec]);

  const blobUrl = useMemo(() => {
    const blob = new Blob([iframeHtml], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [iframeHtml]);

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