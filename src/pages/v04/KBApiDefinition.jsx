import React from 'react';
import { Code2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import ApiEndpointPanel from '@/components/kbapi/ApiEndpointPanel';
import SwaggerYamlPreview from '@/components/kbapi/SwaggerYamlPreview';

export default function KBApiDefinition() {
  const { data: sourceFiles = [] } = useQuery({
    queryKey: ['apiSourceFiles'],
    queryFn: () => base44.entities.ApiSourceFile.list('-sort_order'),
  });

  const sortedFiles = [...sourceFiles].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Code2 className="w-6 h-6 text-accent" />
          API Definition
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define API endpoints for each source file section. Two standard GET methods (list and list/&#123;id&#125;) are generated per section, each with a prefix query parameter. The Swagger configuration updates live as you edit.
        </p>
      </div>

      <ApiEndpointPanel sourceFiles={sortedFiles} />

      <SwaggerYamlPreview />
    </div>
  );
}