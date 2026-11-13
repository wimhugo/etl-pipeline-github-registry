import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, ExternalLink, Layers } from 'lucide-react';
import ApiEndpointRow from './ApiEndpointRow';

export default function ApiGroupCard({ tag, endpoints, basePath, icon: Icon = Layers }) {
  const [showAll, setShowAll] = useState(false);
  const sections = new Set(endpoints.map((ep) => ep.section).filter(Boolean));
  const visible = showAll ? endpoints : endpoints.slice(0, 5);

  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="w-4 h-4 text-primary" />
          {tag}
        </CardTitle>
        <Badge variant="secondary" className="text-[11px] font-medium">
          {endpoints.length} call{endpoints.length === 1 ? '' : 's'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {sections.size} source section{sections.size === 1 ? '' : 's'}
        </p>
        <div>
          {visible.map((ep) => (
            <ApiEndpointRow key={ep.id} endpoint={ep} basePath={basePath} />
          ))}
        </div>
        <div className="flex items-center justify-between pt-1">
          {endpoints.length > 5 ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAll ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              {showAll ? 'Show fewer' : `Show all ${endpoints.length}`}
            </button>
          ) : (
            <span />
          )}
          <Link
            to="/v0.4/kb-api/preview"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Try in preview
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}