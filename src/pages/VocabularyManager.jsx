import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Loader2, Edit, Trash2, RefreshCw, ExternalLink, Code, FileJson, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import VocabularySourceEditor from '@/components/vocabulary/VocabularySourceEditor';

export default function VocabularyManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [testingSource, setTestingSource] = useState(null);

  const { data: vocabSources = [], isLoading } = useQuery({
    queryKey: ['vocabularySources'],
    queryFn: () => base44.entities.VocabularySource.list(),
  });

  const filteredSources = vocabSources.filter(source => {
    const q = searchQuery.toLowerCase();
    return !q || 
      (source.name || '').toLowerCase().includes(q) ||
      (source.description || '').toLowerCase().includes(q) ||
      (source.source_type || '').toLowerCase().includes(q);
  });

  const handleCreate = () => {
    setEditingSource(null);
    setShowEditor(true);
  };

  const handleEdit = (source) => {
    setEditingSource(source);
    setShowEditor(true);
  };

  const handleSave = async (sourceData) => {
    try {
      if (editingSource) {
        await base44.entities.VocabularySource.update(editingSource.id, sourceData);
        toast({ title: 'Vocabulary updated', description: `"${sourceData.name}" saved successfully.` });
      } else {
        await base44.entities.VocabularySource.create(sourceData);
        toast({ title: 'Vocabulary created', description: `"${sourceData.name}" added successfully.` });
      }
      queryClient.invalidateQueries({ queryKey: ['vocabularySources'] });
      setShowEditor(false);
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (source) => {
    if (!confirm(`Delete vocabulary "${source.name}"? This cannot be undone.`)) return;
    
    try {
      await base44.entities.VocabularySource.delete(source.id);
      toast({ title: 'Deleted', description: `"${source.name}" has been removed.` });
      queryClient.invalidateQueries({ queryKey: ['vocabularySources'] });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleTest = (source) => {
    setTestingSource(source);
    testVocabulary.mutate(source.id);
  };

  const testVocabulary = useMutation({
    mutationFn: (id) => base44.functions.invoke('getVocabulary', { vocabularyId: id }),
    onSuccess: (data, variableId) => {
      const source = vocabSources.find(s => s.id === variableId);
      toast({
        title: 'Test successful',
        description: `Found ${data.items?.length || 0} vocabulary items from "${source?.name}"`,
      });
    },
    onError: (error) => {
      toast({ title: 'Test failed', description: error.message, variant: 'destructive' });
    },
  });

  const sourceTypeIcons = {
    github: <Code className="w-3.5 h-3.5" />,
    url: <Globe className="w-3.5 h-3.5" />,
    inline: <FileJson className="w-3.5 h-3.5" />,
  };

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vocabulary Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage controlled vocabularies and link them to form fields across your application.
          </p>
        </div>
        <Button size="sm" className="gap-1.5 shrink-0 mt-1" onClick={handleCreate}>
          <Plus className="w-4 h-4" /> Add Vocabulary
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Search vocabularies..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading vocabularies…
        </div>
      )}

      {!isLoading && filteredSources.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {searchQuery ? 'No vocabularies match your search.' : 'No vocabularies configured yet.'}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {filteredSources.map(source => (
          <Card key={source.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{source.name}</CardTitle>
                    <Badge variant={source.is_active ? 'default' : 'secondary'} className="text-[10px]">
                      {source.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                      {sourceTypeIcons[source.source_type]}
                      {source.source_type}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {source.data_format}
                    </Badge>
                  </div>
                  {source.description && (
                    <CardDescription className="text-xs">{source.description}</CardDescription>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => handleTest(source)}
                    title="Test vocabulary fetch"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => handleEdit(source)}
                    title="Edit vocabulary"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(source)}
                    title="Delete vocabulary"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Source:</span>
                  <div className="font-mono text-[11px] mt-0.5 truncate">
                    {source.source_type === 'github' && `${source.github_repo}/${source.github_path}`}
                    {source.source_type === 'url' && source.source_url}
                    {source.source_type === 'inline' && 'Inline data'}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Path Expression:</span>
                  <div className="font-mono text-[11px] mt-0.5 truncate">
                    {source.json_path_expression || '(root)'}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Value/Label:</span>
                  <div className="font-mono text-[11px] mt-0.5">
                    {source.value_field}/{source.label_field}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Cache:</span>
                  <div className="text-[11px] mt-0.5">
                    {source.cache_duration_minutes} min
                    {source.last_fetched_at && (
                      <span className="text-muted-foreground ml-1">
                        • Last: {new Date(source.last_fetched_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {showEditor && (
        <VocabularySourceEditor
          source={editingSource}
          onSave={handleSave}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}