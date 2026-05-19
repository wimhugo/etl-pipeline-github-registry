import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Loader2, Edit, Trash2, RefreshCw, ExternalLink, Code, FileJson, Globe, Link2, Unlink, CheckSquare, CheckCircle, AlertCircle, Trash } from 'lucide-react';
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

export default function ChecklistManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('sources');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSourceEditor, setShowSourceEditor] = useState(false);
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [testingSource, setTestingSource] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [showTestDialog, setShowTestDialog] = useState(false);

  const { data: checklistSources = [], isLoading: sourcesLoading } = useQuery({
    queryKey: ['checklistSources'],
    queryFn: () => base44.entities.ChecklistSource.list(),
  });

  const { data: checklistLinks = [], isLoading: linksLoading } = useQuery({
    queryKey: ['checklistLinks'],
    queryFn: () => base44.entities.ChecklistLink.list(),
  });

  // Enrich links with checklist source data
  const enrichedLinks = checklistLinks.map(link => {
    const source = checklistSources.find(s => s.id === link.checklist_source_id);
    return { ...link, checklist: source };
  });

  const filteredSources = checklistSources.filter(source => {
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
      await base44.entities.ChecklistLink.create(linkData);
      toast({ title: 'Link created', description: 'Checklist linked to form field successfully.' });
      queryClient.invalidateQueries({ queryKey: ['checklistLinks'] });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteLink = async (link) => {
    if (!confirm(`Remove this checklist link from ${link.target_entity}.${link.target_field}?`)) return;
    
    try {
      await base44.entities.ChecklistLink.delete(link.id);
      toast({ title: 'Link removed', description: 'Checklist link has been deleted.' });
      queryClient.invalidateQueries({ queryKey: ['checklistLinks'] });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleSave = async (sourceData) => {
    try {
      if (editingSource) {
        await base44.entities.ChecklistSource.update(editingSource.id, sourceData);
        toast({ title: 'Checklist updated', description: `"${sourceData.name}" saved successfully.` });
      } else {
        await base44.entities.ChecklistSource.create(sourceData);
        toast({ title: 'Checklist created', description: `"${sourceData.name}" added successfully.` });
      }
      queryClient.invalidateQueries({ queryKey: ['checklistSources'] });
      setShowSourceEditor(false);
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (source) => {
    if (!confirm(`Delete checklist "${source.name}"? This cannot be undone.`)) return;
    
    try {
      await base44.entities.ChecklistSource.delete(source.id);
      toast({ title: 'Deleted', description: `"${source.name}" has been removed.` });
      queryClient.invalidateQueries({ queryKey: ['checklistSources'] });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleTest = (source) => {
    setTestingSource(source);
    testChecklist.mutate(source.id);
  };

  const handleFlushCache = async (source) => {
    if (!confirm(`Clear cache for "${source.name}"? This will force a fresh fetch on next test.`)) return;
    
    try {
      await base44.entities.ChecklistSource.update(source.id, {
        inline_data: '',
        last_fetch_status: 'pending'
      });
      toast({ title: 'Cache cleared', description: 'Checklist cache has been flushed.' });
      queryClient.invalidateQueries({ queryKey: ['checklistSources'] });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const testChecklist = useMutation({
    mutationFn: (id) => base44.functions.invoke('getChecklist', { checklist_source_id: id }),
    onSuccess: (response, variableId) => {
      const source = checklistSources.find(s => s.id === variableId);
      const responseData = response.data || response;
      setTestResult({ source, data: responseData, success: !!responseData.items && responseData.items.length > 0 });
      setShowTestDialog(true);
      setTestingSource(null);
    },
    onError: (error) => {
      const source = checklistSources.find(s => s.id === testChecklist.variables);
      setTestResult({ source, error: error.message, success: false });
      setShowTestDialog(true);
      setTestingSource(null);
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
          <h1 className="text-2xl font-semibold tracking-tight">Checklist Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage checklists and link them to form fields across your application.
          </p>
        </div>
        <div className="flex gap-2 shrink-0 mt-1">
          <Button size="sm" variant={activeTab === 'sources' ? 'default' : 'outline'} onClick={() => setActiveTab('sources')}>
            <CheckSquare className="w-4 h-4 mr-1.5" /> Checklist Sources
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
              placeholder="Search checklists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <Button size="sm" onClick={handleCreateSource}>
              <Plus className="w-4 h-4" /> Add Checklist
            </Button>
          </div>

          {sourcesLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading checklists…
            </div>
          )}

          {!sourcesLoading && filteredSources.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {searchQuery ? 'No checklists match your search.' : 'No checklists configured yet.'}
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
              <Plus className="w-4 h-4" /> Link Checklist
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
                <p className="mb-2">No checklist links configured yet.</p>
                <p className="text-xs">Link your checklists to form fields to enable structured data entry.</p>
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
                      title="Test checklist fetch"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handleFlushCache(source)}
                      title="Clear cache"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handleEditSource(source)}
                      title="Edit checklist"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(source)}
                      title="Delete checklist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
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
                    <span className="text-muted-foreground">Regex:</span>
                    <div className="font-mono text-[11px] mt-0.5">
                      {source.regex_field || '(none)'}
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
                    <span className="text-muted-foreground">Checklist:</span>
                    <div className="font-medium text-[11px] mt-0.5">
                      {link.checklist?.name || 'Unknown'}
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
                      {link.checklist?.source_type || 'N/A'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showSourceEditor && (
        <ChecklistSourceEditor
          source={editingSource}
          onSave={handleSave}
          onClose={() => setShowSourceEditor(false)}
        />
      )}

      {showLinkEditor && (
        <ChecklistLinkEditor
          open={showLinkEditor}
          onClose={() => setShowLinkEditor(false)}
          checklistSources={checklistSources}
          existingLinks={checklistLinks}
          onSave={handleSaveLink}
        />
      )}

      {showTestDialog && (
        <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {testResult?.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-destructive" />
                )}
                Test Results: {testResult?.source?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto mt-4">
              {testResult?.success ? (
                <>
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-800">
                      Successfully fetched <strong>{testResult.data.items?.length || 0}</strong> checklist items.
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    Value field: <code className="bg-muted px-1 py-0.5 rounded">{testResult.source.value_field}</code> | 
                    Label field: <code className="bg-muted px-1 py-0.5 rounded">{testResult.source.label_field}</code>
                  </div>
                  <div className="border rounded-md overflow-hidden">
                    <div className="bg-muted px-3 py-2 text-xs font-medium border-b">
                      Checklist Items ({testResult.data.items?.length || 0})
                    </div>
                    <div className="max-h-64 overflow-auto">
                      {testResult.data.items && testResult.data.items.length > 0 ? (
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50 sticky top-0">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium">ID</th>
                              <th className="text-left px-3 py-2 font-medium">Label</th>
                              <th className="text-left px-3 py-2 font-medium">Description</th>
                              <th className="text-left px-3 py-2 font-medium">Regex</th>
                            </tr>
                          </thead>
                          <tbody>
                            {testResult.data.items.slice(0, 20).map((item, idx) => (
                              <tr key={idx} className="border-t hover:bg-muted/30">
                                <td className="px-3 py-2 font-mono">{item.id}</td>
                                <td className="px-3 py-2 font-medium">{item.label}</td>
                                <td className="px-3 py-2 text-muted-foreground max-w-xs truncate">{item.description || '—'}</td>
                                <td className="px-3 py-2 font-mono text-[10px]">
                                  {item.regex && item.regex.length > 0 ? (
                                    <div className="flex flex-col gap-0.5">
                                      {item.regex.map((r, i) => (
                                        <span key={i} className="bg-muted px-1 py-0.5 rounded truncate max-w-[150px] block">{r}</span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-4 text-center text-muted-foreground">No items found</div>
                      )}
                    </div>
                    {testResult.data.items && testResult.data.items.length > 20 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-t">
                        ... and {testResult.data.items.length - 20} more items
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-md">
                  <p className="text-sm text-destructive font-medium mb-2">Test Failed</p>
                  <pre className="text-xs bg-destructive/5 p-3 rounded overflow-auto max-h-48">
                    {testResult.error}
                  </pre>
                </div>
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button onClick={() => setShowTestDialog(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Inline editors for ChecklistSource and ChecklistLink (same structure as Vocabulary)
function ChecklistSourceEditor({ source, onSave, onClose }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    source_type: 'github',
    source_url: '',
    github_repo: '',
    github_path: '',
    github_branch: 'main',
    data_format: 'json',
    json_path_expression: '',
    value_field: 'id',
    label_field: 'label',
    description_field: 'description',
    regex_field: 'regex',
    recommended_policies: [],
    inline_data: '',
    cache_duration_minutes: 60,
    is_active: true,
  });

  const { data: policies = [] } = useQuery({
    queryKey: ['kb-policies'],
    queryFn: async () => {
      const response = await base44.functions.invoke('githubFiles', {
        action: 'listFolder',
        path: 'input/v0.3'
      });
      // Filter for policy files and extract names
      const policyFiles = (response.data.items || []).filter(item => 
        item.name.includes('policy') || item.name.includes('licence')
      );
      return policyFiles.map(file => ({
        name: file.name.replace('.json', ''),
        path: file.path
      }));
    },
  });

  React.useEffect(() => {
    if (source) {
      setFormData({
        ...source,
        github_branch: source.github_branch || 'main',
        data_format: source.data_format || 'json',
        value_field: source.value_field || 'id',
        label_field: source.label_field || 'label',
        description_field: source.description_field || 'description',
        regex_field: source.regex_field || 'regex',
        recommended_policies: source.recommended_policies || [],
        cache_duration_minutes: source.cache_duration_minutes || 60,
        is_active: source.is_active !== false,
      });
    }
  }, [source]);

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: 'Validation error', description: 'Name is required', variant: 'destructive' });
      return;
    }
    if (formData.source_type === 'github' && (!formData.github_repo || !formData.github_path)) {
      toast({ title: 'Validation error', description: 'GitHub repo and path are required', variant: 'destructive' });
      return;
    }
    if (formData.source_type === 'url' && !formData.source_url) {
      toast({ title: 'Validation error', description: 'Source URL is required', variant: 'destructive' });
      return;
    }
    if (formData.source_type === 'inline' && !formData.inline_data) {
      toast({ title: 'Validation error', description: 'Inline data is required', variant: 'destructive' });
      return;
    }
    onSave(formData);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{source ? 'Edit Checklist' : 'Add Checklist'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., GDPR Checklist, FAIR Data Checklist"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of what this checklist evaluates"
              className="h-20"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="source_type">Source Type *</Label>
              <Select
                value={formData.source_type}
                onValueChange={(value) => setFormData({ ...formData, source_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="github">GitHub</SelectItem>
                  <SelectItem value="url">External URL</SelectItem>
                  <SelectItem value="inline">Inline Data</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_format">Data Format *</Label>
              <Select
                value={formData.data_format}
                onValueChange={(value) => setFormData({ ...formData, data_format: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="json-ld">JSON-LD</SelectItem>
                  <SelectItem value="yaml">YAML</SelectItem>
                  <SelectItem value="ttl">Turtle (TTL)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {formData.source_type === 'github' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="github_repo">GitHub Repository *</Label>
                <Input
                  id="github_repo"
                  value={formData.github_repo}
                  onChange={(e) => setFormData({ ...formData, github_repo: e.target.value })}
                  placeholder="owner/repo"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="github_path">File Path *</Label>
                  <Input
                    id="github_path"
                    value={formData.github_path}
                    onChange={(e) => setFormData({ ...formData, github_path: e.target.value })}
                    placeholder="path/to/checklist.json"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="github_branch">Branch</Label>
                  <Input
                    id="github_branch"
                    value={formData.github_branch}
                    onChange={(e) => setFormData({ ...formData, github_branch: e.target.value })}
                    placeholder="main"
                  />
                </div>
              </div>
            </>
          )}
          {formData.source_type === 'url' && (
            <div className="space-y-2">
              <Label htmlFor="source_url">Source URL *</Label>
              <Input
                id="source_url"
                value={formData.source_url}
                onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
                placeholder="https://example.com/checklist.json"
              />
            </div>
          )}
          {formData.source_type === 'inline' && (
            <div className="space-y-2">
              <Label htmlFor="inline_data">Inline JSON Data *</Label>
              <Textarea
                id="inline_data"
                value={formData.inline_data}
                onChange={(e) => setFormData({ ...formData, inline_data: e.target.value })}
                placeholder='[{"id": "gdpr_1", "label": "Consent obtained", "description": "..."}]'
                className="h-40 font-mono text-xs"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="json_path_expression">JSON Path Expression</Label>
            <Input
              id="json_path_expression"
              value={formData.json_path_expression}
              onChange={(e) => setFormData({ ...formData, json_path_expression: e.target.value })}
              placeholder="e.g., $.items[*] or checklist"
            />
          </div>
          <div className="grid grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="value_field">Value Field</Label>
            <Input
              id="value_field"
              value={formData.value_field}
              onChange={(e) => setFormData({ ...formData, value_field: e.target.value })}
              placeholder="id"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="label_field">Label Field</Label>
            <Input
              id="label_field"
              value={formData.label_field}
              onChange={(e) => setFormData({ ...formData, label_field: e.target.value })}
              placeholder="label"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description_field">Description Field</Label>
            <Input
              id="description_field"
              value={formData.description_field}
              onChange={(e) => setFormData({ ...formData, description_field: e.target.value })}
              placeholder="description"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="regex_field">Regex Field</Label>
            <Input
              id="regex_field"
              value={formData.regex_field}
              onChange={(e) => setFormData({ ...formData, regex_field: e.target.value })}
              placeholder="regex"
            />
          </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="recommended_policies">Recommended Policies</Label>
            <Select
              value={formData.recommended_policies.length > 0 ? formData.recommended_policies[0] : ''}
              onValueChange={(value) => {
                if (!formData.recommended_policies.includes(value)) {
                  setFormData({ ...formData, recommended_policies: [...formData.recommended_policies, value] });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a policy" />
              </SelectTrigger>
              <SelectContent>
                {policies.map(policy => (
                  <SelectItem key={policy.name} value={policy.name}>{policy.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formData.recommended_policies.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {formData.recommended_policies.map(policyId => (
                  <Badge key={policyId} variant="secondary" className="text-xs">
                    {policyId}
                    <button
                      onClick={() => setFormData({ ...formData, recommended_policies: formData.recommended_policies.filter(p => p !== policyId) })}
                      className="ml-1 hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cache_duration_minutes">Cache Duration (minutes)</Label>
            <Input
              id="cache_duration_minutes"
              type="number"
              value={formData.cache_duration_minutes}
              onChange={(e) => setFormData({ ...formData, cache_duration_minutes: parseInt(e.target.value) || 60 })}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Active</Label>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit}>{source ? 'Save Changes' : 'Create Checklist'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChecklistLinkEditor({ open, onClose, checklistSources, existingLinks, onSave }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    checklist_source_id: '',
    target_entity: '',
    target_field: '',
    display_label: '',
    is_required: false,
    allow_multiple: false,
    sort_order: 0,
    is_active: true,
    notes: '',
  });

  const handleSubmit = () => {
    if (!formData.checklist_source_id) {
      toast({ title: 'Validation error', description: 'Please select a checklist', variant: 'destructive' });
      return;
    }
    if (!formData.target_entity || !formData.target_field) {
      toast({ title: 'Validation error', description: 'Target entity and field are required', variant: 'destructive' });
      return;
    }
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link Checklist to Form Field</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Checklist Source *</Label>
            <Select
              value={formData.checklist_source_id}
              onValueChange={(value) => setFormData({ ...formData, checklist_source_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a checklist" />
              </SelectTrigger>
              <SelectContent>
                {checklistSources.map(source => (
                  <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Target Entity *</Label>
            <Input
              value={formData.target_entity}
              onChange={(e) => setFormData({ ...formData, target_entity: e.target.value })}
              placeholder="e.g., Policy, Action, Constraint"
            />
          </div>
          <div className="space-y-2">
            <Label>Target Field *</Label>
            <Input
              value={formData.target_field}
              onChange={(e) => setFormData({ ...formData, target_field: e.target.value })}
              placeholder="e.g., status, type, category"
            />
          </div>
          <div className="space-y-2">
            <Label>Display Label</Label>
            <Input
              value={formData.display_label}
              onChange={(e) => setFormData({ ...formData, display_label: e.target.value })}
              placeholder="e.g., Policy Status"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_required}
                onCheckedChange={(checked) => setFormData({ ...formData, is_required: checked })}
              />
              <Label>Required</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.allow_multiple}
                onCheckedChange={(checked) => setFormData({ ...formData, allow_multiple: checked })}
              />
              <Label>Allow Multiple</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="h-20"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit}>Save Link</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}