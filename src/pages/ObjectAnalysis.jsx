import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Microscope } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import ObjectAnalysisCard from '@/components/objectanalysis/ObjectAnalysisCard';
import ObjectAnalysisEditor from '@/components/objectanalysis/ObjectAnalysisEditor';
import EmptyState from '@/components/shared/EmptyState';

export default function ObjectAnalysis() {
  const [showEditor, setShowEditor] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [search, setSearch] = useState('');
  const [openrelActions, setOpenrelActions] = useState([]);
  const [openrelConstraints, setOpenrelConstraints] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const queryClient = useQueryClient();

  // Fetch OpenREL Actions and Constraints from GlobalConfig
  useEffect(() => {
    const fetchOpenrelData = async () => {
      try {
        const configs = await base44.entities.GlobalConfig.list();
        if (configs && configs.length > 0) {
          const config = configs[0];
          const subEntityFiles = config.kb_sub_entity_files || {};
          const dataBaseUrl = config.kb_search_data_url;
          const apiUrl = config.kb_search_data_api_url?.replace(/\?ref=[^&]*/, '');

          let actionsFile = subEntityFiles.actions;
          let constraintsFile = subEntityFiles.constraints;

          if (apiUrl && (!actionsFile || !constraintsFile)) {
            const fileRes = await fetch(apiUrl);
            if (fileRes.ok) {
              const fileList = await fileRes.json();
              const jsonFiles = fileList.filter(f => f.name?.toLowerCase().endsWith('.json'));
              const autoFile = (hint) => jsonFiles.find(f => f.name.toLowerCase().includes(hint))?.name || '';
              if (!actionsFile) actionsFile = autoFile('action');
              if (!constraintsFile) constraintsFile = autoFile('constraint');
            }
          }

          if (actionsFile && dataBaseUrl) {
            const res = await fetch(`${dataBaseUrl}/${actionsFile}`);
            if (res.ok) {
              const data = await res.json();
              setOpenrelActions(Array.isArray(data) ? data : (data.actions || []));
            }
          }

          if (constraintsFile && dataBaseUrl) {
            const res = await fetch(`${dataBaseUrl}/${constraintsFile}`);
            if (res.ok) {
              const data = await res.json();
              setOpenrelConstraints(Array.isArray(data) ? data : (data.constraints || []));
            }
          }
        }
      } catch (e) {
        // silently ignore
      } finally {
        setDataLoaded(true);
      }
    };
    fetchOpenrelData();
  }, []);

  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ['object-analyses'],
    queryFn: () => base44.entities.ObjectAnalysis.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ObjectAnalysis.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['object-analyses'] });
      setShowEditor(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ObjectAnalysis.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['object-analyses'] });
      setEditingItem(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ObjectAnalysis.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['object-analyses'] });
      setDeletingItem(null);
    },
  });

  const copyMutation = useMutation({
    mutationFn: (item) => {
      const { id, created_date, updated_date, created_by, ...rest } = item;
      return base44.entities.ObjectAnalysis.create({
        ...rest,
        name: `${item.name} (copy)`,
        last_analysed_at: null,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['object-analyses'] }),
  });

  const filtered = analyses.filter(a =>
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = (data) => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: { ...data, last_analysed_at: data.analysis_result ? new Date().toISOString() : editingItem.last_analysed_at } });
    } else {
      createMutation.mutate({ ...data, last_analysed_at: data.analysis_result ? new Date().toISOString() : undefined });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Object Analysis</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Detect OpenREL/ODRL rules, actions, and constraints in objects and documents.
          </p>
        </div>
        <Button onClick={() => { setEditingItem(null); setShowEditor(true); }} className="gap-2">
          <Plus className="w-4 h-4" />
          New Analysis
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search analyses..."
          className="pl-9 bg-muted/50 text-sm"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-44 rounded-lg bg-card animate-pulse border border-border/50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Microscope}
          title={search ? 'No matches' : 'No analyses yet'}
          description={search ? 'Try a different search term.' : 'Create your first object analysis to detect OpenREL/ODRL patterns.'}
          actionLabel={!search ? 'New Analysis' : undefined}
          onAction={!search ? () => { setEditingItem(null); setShowEditor(true); } : undefined}
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map(a => (
            <ObjectAnalysisCard
              key={a.id}
              analysis={a}
              onEdit={(item) => { setEditingItem(item); setShowEditor(true); }}
              onCopy={(item) => copyMutation.mutate(item)}
              onDelete={(item) => setDeletingItem(item)}
            />
          ))}
        </div>
      )}

      {/* Editor dialog */}
      <ObjectAnalysisEditor
        open={showEditor}
        initialData={editingItem}
        onClose={() => { setShowEditor(false); setEditingItem(null); }}
        onSave={handleSave}
        openrelActions={openrelActions}
        openrelConstraints={openrelConstraints}
        dataLoaded={dataLoaded}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingItem} onOpenChange={() => setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete analysis?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletingItem?.name}" will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate(deletingItem.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}