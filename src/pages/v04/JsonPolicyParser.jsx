import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Loader2, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import JsonParserCard from '@/components/jsonparser/JsonParserCard';
import JsonParserEditor from '@/components/jsonparser/JsonParserEditor';

export default function JsonPolicyParser() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [executingIds, setExecutingIds] = useState(new Set());

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['jsonPolicyParsers'],
    queryFn: () => base44.entities.JsonPolicyParser.list('-created_date'),
  });

  const handleCreate = () => {
    setEditingConfig(null);
    setShowEditor(true);
  };

  const handleEdit = (config) => {
    setEditingConfig(config);
    setShowEditor(true);
  };

  const handleSave = async (formData) => {
    try {
      if (editingConfig) {
        await base44.entities.JsonPolicyParser.update(editingConfig.id, formData);
        toast({ title: 'Updated', description: `"${formData.name}" saved successfully.` });
      } else {
        await base44.entities.JsonPolicyParser.create(formData);
        toast({ title: 'Created', description: `"${formData.name}" added successfully.` });
      }
      queryClient.invalidateQueries({ queryKey: ['jsonPolicyParsers'] });
      setShowEditor(false);
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (config) => {
    if (!confirm(`Delete "${config.name}"? This cannot be undone.`)) return;
    try {
      await base44.entities.JsonPolicyParser.delete(config.id);
      toast({ title: 'Deleted', description: `"${config.name}" has been removed.` });
      queryClient.invalidateQueries({ queryKey: ['jsonPolicyParsers'] });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleClone = async (config) => {
    try {
      const { id, created_date, updated_date, created_by_id, last_run_at, last_run_status, last_run_message, ...rest } = config;
      await base44.entities.JsonPolicyParser.create({
        ...rest,
        name: `${config.name} (Copy)`,
        last_run_status: 'pending',
        last_run_message: '',
        last_run_at: null,
      });
      toast({ title: 'Cloned', description: `Created a copy of "${config.name}".` });
      queryClient.invalidateQueries({ queryKey: ['jsonPolicyParsers'] });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleExecute = async (config) => {
    setExecutingIds(prev => new Set(prev).add(config.id));
    try {
      const res = await base44.functions.invoke('jsonToTtl', { config_id: config.id });
      const data = res.data || res;
      if (data.status === 'success') {
        toast({ title: 'Pipeline complete', description: `Wrote ${data.ttl_length} bytes to ${data.target_path}` });
      } else {
        toast({ title: 'Pipeline failed', description: data.error || 'Unknown error', variant: 'destructive' });
      }
      queryClient.invalidateQueries({ queryKey: ['jsonPolicyParsers'] });
    } catch (error) {
      toast({ title: 'Pipeline failed', description: error.message, variant: 'destructive' });
      queryClient.invalidateQueries({ queryKey: ['jsonPolicyParsers'] });
    } finally {
      setExecutingIds(prev => {
        const next = new Set(prev);
        next.delete(config.id);
        return next;
      });
    }
  };

  const isExecuting = (id) => executingIds.has(id);

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FileJson className="w-6 h-6 text-primary" />
            JSON Policy Parser
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Convert JSON input files or text blobs into RDF Turtle, then write the result to a GitHub target.
          </p>
        </div>
        <Button size="sm" onClick={handleCreate} className="shrink-0 mt-1">
          <Plus className="w-4 h-4" /> Add Configuration
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading configurations…
        </div>
      )}

      {!isLoading && configs.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileJson className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="mb-1">No parser configurations yet.</p>
            <p className="text-xs">Click "Add Configuration" to create your first JSON-to-TTL pipeline.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {configs.map(config => (
          <JsonParserCard
            key={config.id}
            config={config}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onClone={handleClone}
            onExecute={handleExecute}
            isExecuting={isExecuting}
          />
        ))}
      </div>

      {showEditor && (
        <JsonParserEditor
          config={editingConfig}
          onSave={handleSave}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}