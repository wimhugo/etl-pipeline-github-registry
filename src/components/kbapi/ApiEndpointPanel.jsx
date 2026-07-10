import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ApiEndpointCard from './ApiEndpointCard';

export default function ApiEndpointPanel({ sourceFiles = [] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: endpoints = [] } = useQuery({
    queryKey: ['apiEndpoints'],
    queryFn: () => base44.entities.ApiEndpoint.list('-sort_order'),
  });

  const generateDefaults = useMutation({
    mutationFn: async () => {
      const existingSections = new Set(endpoints.map(e => e.section));
      const toCreate = [];
      for (const sf of sourceFiles) {
        if (existingSections.has(sf.section)) continue;
        const base = `openrel/api/v0.4/${sf.section.toLowerCase()}`;
        toCreate.push({
          section: sf.section,
          tag: 'default',
          method: 'GET',
          path: base,
          endpoint_type: 'list',
          summary: `List ${sf.section}`,
          description: `Lists all members of the ${sf.section} source file (IRI, label, definition)`,
          parameters: [{ name: 'prefix', in: 'query', required: false, schema_type: 'string', description: 'Filter by compact identifier prefix' }],
          target_logic_type: 'fetchApiSourceContent',
          logic_config: { section: sf.section },
          sort_order: (sf.sort_order ?? 0) * 10,
          is_active: true,
        });
        toCreate.push({
          section: sf.section,
          tag: 'default',
          method: 'GET',
          path: `${base}/{id}`,
          endpoint_type: 'detail',
          summary: `Get ${sf.section} by ID`,
          description: `Returns a single member matching the IRI filter`,
          parameters: [
            { name: 'id', in: 'path', required: true, schema_type: 'string', description: 'Member IRI or compact identifier' },
            { name: 'prefix', in: 'query', required: false, schema_type: 'string', description: 'Filter by compact identifier prefix' },
          ],
          target_logic_type: 'fetchApiSourceContent',
          logic_config: { section: sf.section },
          sort_order: (sf.sort_order ?? 0) * 10 + 1,
          is_active: true,
        });
      }
      if (toCreate.length === 0) return [];
      return await base44.entities.ApiEndpoint.bulkCreate(toCreate);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['apiEndpoints'] });
      const count = Array.isArray(data) ? data.length : 0;
      toast({
        title: count > 0 ? `${count} endpoints generated` : 'Nothing to generate',
        description: count > 0 ? 'Default list and detail endpoints created for all source files.' : 'All source file sections already have endpoints.',
      });
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const saveEndpoint = useMutation({
    mutationFn: ({ id, data }) => id
      ? base44.entities.ApiEndpoint.update(id, data)
      : base44.entities.ApiEndpoint.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiEndpoints'] });
      toast({ title: 'Saved', description: 'Endpoint configuration updated.' });
    },
  });

  const deleteEndpoint = useMutation({
    mutationFn: (id) => base44.entities.ApiEndpoint.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiEndpoints'] });
      toast({ title: 'Deleted', description: 'Endpoint removed.' });
    },
  });

  const [draft, setDraft] = useState(null);

  const createEndpoint = useMutation({
    mutationFn: (data) => base44.entities.ApiEndpoint.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiEndpoints'] });
      setDraft(null);
      toast({ title: 'Created', description: 'New endpoint created.' });
    },
  });

  const handleAdd = () => {
    setDraft({
      section: '',
      tag: 'default',
      method: 'GET',
      path: '',
      endpoint_type: 'list',
      parameters: [],
      target_logic_type: '',
      logic_config: {},
      is_active: true,
      sort_order: 0,
    });
  };

  const handleClone = (ep) => {
    const { id, created_date, updated_date, created_by_id, ...rest } = ep;
    setDraft({
      ...rest,
      path: `${ep.path || ''}-copy`,
      parameters: (ep.parameters || []).map(p => ({ ...p })),
      logic_config: { ...(ep.logic_config || {}) },
      target_logic_type: ep.target_logic_type || '',
    });
  };

  const sorted = [...endpoints].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const availableTags = [...new Set(endpoints.map(e => e.tag || 'default').filter(Boolean))].sort();

  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4" /> API Endpoints
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={handleAdd}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Endpoint
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => generateDefaults.mutate()}
              disabled={generateDefaults.isPending || sourceFiles.length === 0}
            >
              <Zap className="w-3.5 h-3.5" />
              Generate Defaults
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 && !draft ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No API endpoints defined yet.
            <br />
            Click "Add Endpoint" or "Generate Defaults" to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {draft && (
              <ApiEndpointCard
                key="draft"
                endpoint={draft}
                sourceFiles={sourceFiles}
                availableTags={availableTags}
                onSave={(data) => createEndpoint.mutate(data)}
                onDelete={() => setDraft(null)}
                onClone={handleClone}
              />
            )}
            {sorted.map(ep => (
              <ApiEndpointCard
                key={ep.id}
                endpoint={ep}
                sourceFiles={sourceFiles}
                availableTags={availableTags}
                onSave={(data) => saveEndpoint.mutate({ id: ep.id, data })}
                onDelete={() => { if (window.confirm('Delete this endpoint?')) deleteEndpoint.mutate(ep.id); }}
                onClone={handleClone}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}