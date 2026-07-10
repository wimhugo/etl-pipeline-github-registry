import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, Download, FileText } from 'lucide-react';
import { generateSwaggerYaml } from '@/lib/swaggerYaml';

export default function SwaggerYamlPreview() {
  const [copied, setCopied] = useState(false);

  const { data: endpoints = [] } = useQuery({
    queryKey: ['apiEndpoints'],
    queryFn: () => base44.entities.ApiEndpoint.list('-sort_order'),
  });

  const yaml = generateSwaggerYaml(endpoints);

  const handleCopy = () => {
    navigator.clipboard.writeText(yaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'openrel-api-swagger.yaml';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4" /> Swagger Configuration (YAML)
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleCopy}>
              {copied ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleDownload}>
              <Download className="w-3.5 h-3.5" />
              Download
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <pre className="text-xs font-mono text-muted-foreground bg-muted/30 rounded-lg border border-border/40 p-4 overflow-auto max-h-96 whitespace-pre">
          {yaml}
        </pre>
      </CardContent>
    </Card>
  );
}