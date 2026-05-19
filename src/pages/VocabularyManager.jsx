import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Loader2, Edit, Trash2, RefreshCw, ExternalLink, Code, FileJson, Globe, Link2, Unlink, KeyRound } from 'lucide-react';
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
import VocabularyLinkEditor from '@/components/vocabulary/VocabularyLinkEditor';

export default function VocabularyManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('sources');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSourceEditor, setShowSourceEditor] = useState(false);
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [testingSource, setTestingSource] = useState(null);

  const { data: vocabSources = [], isLoading: sourcesLoading } = useQuery({
    queryKey: ['vocabularySources'],
    queryFn: () => base44.entities.VocabularySource.list(),
  });

  const { data: vocabLinks = [], isLoading: linksLoading } = useQuery({
    queryKey: ['vocabularyLinks'],
    queryFn: () => base44.entities.VocabularyLink.list(),
  });

  // Enrich links with vocabulary source data
  const enrichedLinks = vocabLinks.map(link => {
    const source = vocabSources.find(s => s.id === link.vocabulary_source_id);
    return { ...link, vocabulary: source };
  });

  const filteredSources = vocabSources.filter(source => {
    const q = searchQuery.toLowerCase();
    return !q || 
      (source.name || '').toLowerCase().includes(q) ||
      (source.description || '').toLowerCase().includes(q) ||
      (source.source_type || '').toLowerCase().includes(q);
  });

  const handleCreateSource = () => {
    setEditingSource(null);
    setShowSourceEditor(true);
  };

  const handleEditSource = (source) => {
    setEditingSource(source);
    setShowSourceEditor(true);
  };

  const handleCreateLink = () => {
    setShowLinkEditor(true);
  };

  const handleSaveLink = async (linkData) => {
    try {
      await base44.entities.VocabularyLink.create(linkData);
      toast({ title: 'Link created', description: 'Vocabulary linked to form field successfully.' });
      queryClient.invalidateQueries({ queryKey: ['vocabularyLinks'] });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteLink = async (link) => {
    if (!confirm(`Remove this vocabulary link from ${link.target_entity}.${link.target_field}?`)) return;
    
    try {
      await base44.entities.VocabularyLink.delete(link.id);
      toast({ title: 'Link removed', description: 'Vocabulary link has been deleted.' });
      queryClient.invalidateQueries({ queryKey: ['vocabularyLinks'] });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
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
        <div className="flex gap-2 shrink-0 mt-1">
          <Button size="sm" variant={activeTab === 'sources' ? 'default' : 'outline'} onClick={() => setActiveTab('sources')}>
            <KeyRound className="w-4 h-4 mr-1.5" /> Vocabulary Sources
          </Button>
          <Button size="sm" variant={activeTab === 'links' ? 'default' : 'outline'} onClick={() => setActiveTab('links')}>
            <Link2 className="w-4 h-4 mr-1.5" /> Form Field Links
          </Button>
        </div>
      </div>

      {activeTab === 'sources' && (
        <>
          <div className="flex items-center justify-between gap-2">
            <Input
              placeholder="Search vocabularies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <Button size="sm" onClick={handleCreateSource}>
              <Plus className="w-4 h-4" /> Add Vocabulary
            </Button>
          </div>

          {sourcesLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading vocabularies…
            </div>
          )}

          {!sourcesLoading && filteredSources.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {searchQuery ? 'No vocabularies match your search.' : 'No vocabularies configured yet.'}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {activeTab === 'links' && (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              {enrichedLinks.length} {enrichedLinks.length === 1 ? 'link' : 'links'} configured
            </div>
            <Button size="sm" onClick={handleCreateLink}>
              <Plus className="w-4 h-4" /> Link Vocabulary
            </Button>
          </div>

          {linksLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading links…
            </div>
          )}

          {!linksLoading && enrichedLinks.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p className="mb-2">No vocabulary links configured yet.</p>
                <p className="text-xs">Link your vocabularies to form fields to enable controlled data entry.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {activeTab === 'sources' && (
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
                      onClick={() => handleEditSource(source)}
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
      )}

      {activeTab === 'links' && (
        <div className="grid gap-4">
          {enrichedLinks.map(link => (
            <Card key={link.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{link.display_label || `${link.target_entity}.${link.target_field}`}</CardTitle>
                      <Badge variant={link.is_active ? 'default' : 'secondary'} className="text-[10px]">
                        {link.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      {link.allow_multiple && (
                        <Badge variant="outline" className="text-[10px]">Multi-select</Badge>
                      )}
                      {link.is_required && (
                        <Badge variant="outline" className="text-[10px]">Required</Badge>
                      )}
                    </div>
                    {link.notes && (
                      <CardDescription className="text-xs">{link.notes}</CardDescription>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteLink(link)}
                    title="Remove link"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Vocabulary:</span>
                    <div className="font-medium text-[11px] mt-0.5">
                      {link.vocabulary?.name || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Target Entity:</span>
                    <div className="font-mono text-[11px] mt-0.5">
                      {link.target_entity}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Target Field:</span>
                    <div className="font-mono text-[11px] mt-0.5">
                      {link.target_field}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Source Type:</span>
                    <div className="text-[11px] mt-0.5">
                      {link.vocabulary?.source_type || 'N/A'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showSourceEditor && (
        <VocabularySourceEditor
          source={editingSource}
          onSave={handleSave}
          onClose={() => setShowSourceEditor(false)}
        />
      )}

      {showLinkEditor && (
        <VocabularyLinkEditor
          open={showLinkEditor}
          onClose={() => setShowLinkEditor(false)}
          vocabularySources={vocabSources}
          existingLinks={vocabLinks}
          onSave={handleSaveLink}
        />
      )}
    </div>
  );
}