import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { generateSwaggerSpec } from '@/lib/swaggerSpec';
import SwaggerUiContainer from '@/components/kbapi/SwaggerUiContainer';
import { createRequestInterceptor } from '@/lib/swaggerRequestInterceptor';

const DISPLAY_SERVER_URL = 'https://api.openrel.org/v0.4';

export default function KBApiPreviewStandalone() {
  const { data: endpoints = [] } = useQuery({
    queryKey: ['apiEndpoints'],
    queryFn: () => base44.entities.ApiEndpoint.list('-sort_order'),
  });

  const spec = useMemo(
    () => generateSwaggerSpec(endpoints, { serverUrl: DISPLAY_SERVER_URL }),
    [endpoints]
  );

  const requestInterceptor = useMemo(
    () => createRequestInterceptor(DISPLAY_SERVER_URL),
    []
  );

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <SwaggerUiContainer spec={spec} requestInterceptor={requestInterceptor} />
      </div>
    </div>
  );
}