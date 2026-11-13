import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import StatCard from '@/components/shared/StatCard';
import ApiGroupCard from '@/components/kbapi/ApiGroupCard';
import {
  Boxes, Code2, Eye, Layers, Loader2, ListTree, Network, Tags,
} from 'lucide-react';

const TAG_ICONS = {
  Classes: Boxes,
  'Class Instances': ListTree,
  Mappings: Network,
  Indexing: Tags,
  'Policy Index': Tags,
};

function commonBase(paths) {
  if (!paths.length) return '';
  const split = paths.map((p) => ('/' + String(p).replace(/^\/+/, '')).split('/'));
  const shortest = Math.min(...split.map((s) => s.length - 1));
  const out = [];
  for (let i = 1; i <= shortest; i++) {
    const seg = split[0][i];
    if (!split.every((s) => s[i] === seg)) break;
    out.push(seg);
  }
  return out.length ? '/' + out.join('/') : '';
}

export default function KBApi() {
  const { data: endpoints = [], isLoading } = useQuery({
    queryKey: ['apiEndpoints'],
    queryFn: () => base44.entities.ApiEndpoint.list('-sort_order'),
  });

  const { groups, basePath, listCount, detailCount } = useMemo(() => {
    const active = endpoints.filter((ep) => ep.is_active !== false);
    const byTag = new Map();
    for (const ep of active) {
      const tag = ep.tag || 'default';
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag).push(ep);
    }
    return {
      groups: [...byTag.entries()],
      basePath: commonBase(active.map((ep) => ep.path)),
      listCount: active.filter((ep) => ep.endpoint_type !== 'detail').length,
      detailCount: active.filter((ep) => ep.endpoint_type === 'detail').length,
    };
  }, [endpoints]);

  const sections = new Set(
    endpoints.filter((ep) => ep.is_active !== false).map((ep) => ep.section).filter(Boolean)
  ).size;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" />
            KB API
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            The calls the knowledge base API exposes, grouped by resource family.
            {basePath && (
              <> Base path <span className="font-mono text-foreground">{basePath}</span>.</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link to="/v0.4/kb-api/definition">
              <Code2 className="w-3.5 h-3.5" />
              API Definition
            </Link>
          </Button>
          <Button size="sm" asChild className="gap-1.5">
            <Link to="/v0.4/kb-api/preview">
              <Eye className="w-3.5 h-3.5" />
              API Preview
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Endpoints" value={endpoints.filter((e) => e.is_active !== false).length} icon={Layers} />
        <StatCard title="Groups" value={groups.length} subtitle="By resource family" icon={Boxes} />
        <StatCard title="List calls" value={listCount} subtitle="Collections" icon={ListTree} />
        <StatCard title="Detail calls" value={detailCount} subtitle={`Across ${sections} sections`} icon={Tags} />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading API groups…
        </div>
      ) : groups.length === 0 ? (
        <Card className="bg-card border-border/50">
          <CardContent className="py-10 text-center space-y-3">
            <p className="text-sm font-medium">No API calls defined yet</p>
            <p className="text-xs text-muted-foreground">
              Define endpoints per source section to make them available here.
            </p>
            <Button size="sm" asChild className="gap-1.5">
              <Link to="/v0.4/kb-api/definition">
                <Code2 className="w-3.5 h-3.5" />
                Open API Definition
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 items-start">
          {groups.map(([tag, eps]) => (
            <ApiGroupCard
              key={tag}
              tag={tag}
              endpoints={eps}
              basePath={basePath}
              icon={TAG_ICONS[tag] || Layers}
            />
          ))}
        </div>
      )}
    </div>
  );
}