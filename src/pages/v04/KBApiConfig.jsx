import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, FileCode2, Settings } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ApiSourceFileEditor from '@/components/kbapi/ApiSourceFileEditor';
import ApiSourceFilePreview from '@/components/kbapi/ApiSourceFilePreview';

export default function KBApiConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const { data: sourceFiles = [] } = useQuery({
    queryKey: ['apiSourceFiles'],
    queryFn: () => base44.entities.ApiSourceFile.list('-sort_order'),
  });

  const sortedFiles = [...sourceFiles].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ApiSourceFile.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiSourceFiles'] });
      toast({ title: 'Added', description: 'API source file created.' });
      setEditorOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ApiSourceFile.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiSourceFiles'] });
      toast({ title: 'Updated', description: 'API source file updated.' });
      setEditorOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ApiSourceFile.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiSourceFiles'] });
      toast({ title: 'Deleted', description: 'API source file removed.' });
    },
  });

  const handleSave = (data) => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (item) => {
    if (window.confirm(`Delete "${item.section}"?`)) {
      deleteMutation.mutate(item.id);
    }
  };

  const openAdd = () => {
    setEditingItem(null);
    setEditorOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setEditorOpen(true);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            KB API Configuration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define API sections and their GitHub source files. The GitHub connection is shared with KB Manager Settings.
          </p>
        </div>
        <Button onClick={openAdd} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Add Source File
        </Button>
      </div>

      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <FileCode2 className="w-4 h-4" /> API Source Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedFiles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No API source files configured yet.
              <br />
              Click "Add Source File" to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {sortedFiles.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border/40 bg-muted/20 overflow-hidden"
                >
                  <div className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm">{item.section}</span>
                        <Badge variant="outline" className="text-xs font-mono">{item.data_format || 'ttl'}</Badge>
                        {!item.is_active && (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate">{item.file_path}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <ApiSourceFilePreview item={item} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ApiSourceFileEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
        sourceFile={editingItem}
      />

    </div>
  );
}