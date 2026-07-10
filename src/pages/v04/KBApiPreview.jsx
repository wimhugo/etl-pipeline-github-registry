import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Eye, ExternalLink } from 'lucide-react';
import { generateSwaggerSpec } from '@/lib/swaggerSpec';
import SwaggerUiContainer from '@/components/kbapi/SwaggerUiContainer';

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

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <SwaggerUiContainer spec={spec} />
      </div>
    </div>
  );
}