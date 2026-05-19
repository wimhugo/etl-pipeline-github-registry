import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Loader2, FileJson, Database, AlertCircle, Tag, ChevronDown, ChevronRight, LayoutGrid } from 'lucide-react';
import FeatureCardsEditor from '@/components/kbuser/FeatureCardsEditor';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import BadgeMappingTable from '@/components/kbuser/BadgeMappingTable';

const SUB_ENTITY_HINTS = ['actions', 'constraints', 'agents', 'sources', 'scenarios', 'template', 'states'];

function fileHint(filename) {
  const lower = filename.toLowerCase();
  for (const hint of SUB_ENTITY_HINTS) {
    if (lower.includes(hint)) return hint;
  }
  return null;
}

// Parse a standard GitHub browser folder URL into API + raw URLs
// Always targets the default branch (main) — ignores whatever segment follows /tree/
function parseGithubFolderUrl(url) {
  try {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/[^/]+\/(.+)/);
    if (!match) return null;
    const [, owner, repo, path] = match;
    return {
      apiUrl: `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      rawUrl: `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`,
    };
  } catch {
    return null;
  }
}

// Reconstruct a browser URL from a stored API URL
function reconstructBrowserUrl(apiUrl) {
  const m = apiUrl?.match(/api\.github\.com\/repos\/([^/]+)\/([^/]+)\/contents\/([^?]+)/);
  if (!m) return '';
  return `https://github.com/${m[1]}/${m[2]}/tree/main/${m[3]}`;
}

export default function KBUserConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({});
  const [folderUrl, setFolderUrl] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: globalConfigs = [] } = useQuery({
    queryKey: ['globalConfig'],
    queryFn: () => base44.entities.GlobalConfig.list(),
  });
  const globalConfig = globalConfigs[0];

  useEffect(() => {
    if (globalConfig) {
      console.log('📥 Loading GlobalConfig:', globalConfig);
      console.log('📊 badge_mappings from DB:', globalConfig.badge_mappings);
      console.log('🔍 github_repo from DB:', globalConfig.github_repo);
      console.log('🔍 github_branch from DB:', globalConfig.github_branch);
      // Extract repo/branch from kb_search_data_api_url if github_repo not set
      let repo = globalConfig.github_repo;
      let branch = globalConfig.github_branch || 'main';
      if (!repo && globalConfig.kb_search_data_api_url) {
        const match = globalConfig.kb_search_data_api_url.match(/api\.github\.com\/repos\/([^/]+\/[^/]+)\//);
        if (match) {
          repo = match[1];
          console.log('🔍 Extracted repo from API URL:', repo);
        }
      }
      console.log('✅ Final repo/branch:', repo, branch);
      setForm({ ...globalConfig, github_repo: repo, github_branch: branch });
      setFolderUrl(reconstructBrowserUrl(globalConfig.kb_search_data_api_url));
    }
  }, [globalConfig?.id]);

  const parsed = parseGithubFolderUrl(folderUrl);

  // Use parsed or existing stored API URL to list files (strip any stale ?ref= param)
  const apiUrl = (parsed?.apiUrl || form.kb_search_data_api_url || '').replace(/\?ref=[^&]*/, '');

  const { data: fileList = [], isLoading: filesLoading, error: filesError } = useQuery({
    queryKey: ['kbSearchFiles', apiUrl],
    queryFn: async () => {
      console.log('📥 Fetching file list from:', apiUrl);
      const res = await fetch(`${apiUrl}?_=${Date.now()}`);
      console.log('📄 File list response status:', res.status);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ File list error:', errorText);
        throw new Error(`Failed to fetch file list: ${res.status}`);
      }
      const data = await res.json();
      console.log('✅ File list:', data.length, 'files');
      return data;
    },
    enabled: !!apiUrl,
    staleTime: 0,
    gcTime: 0,
  });

  const jsonFiles = fileList.filter(f => f.name?.toLowerCase().endsWith('.json'));

  const autoDetected = {};
  for (const hint of SUB_ENTITY_HINTS) {
    const matches = jsonFiles.filter(f => fileHint(f.name) === hint);
    if (matches.length) autoDetected[hint] = matches[0].name;
  }

  const subEntityFiles = form.kb_sub_entity_files || {};
  // Auto-detect constraints file if not explicitly set (same as dashboard)
  const autoConstraintsFile = jsonFiles.find(f => f.name.toLowerCase().includes('constraint'))?.name || '';
  const constraintsFile = subEntityFiles.constraints || autoConstraintsFile;
  const dataBaseUrl = form.kb_search_data_url;
  
  // Debug logging
  console.log('KBUserConfig render:', {
    subEntityFiles,
    autoConstraintsFile,
    constraintsFile,
    dataBaseUrl,
    jsonFileCount: jsonFiles.length,
  });

  // Fetch constraints file to extract labels for the dropdown
  const { data: constraintsData = [], isLoading: constraintsLoading, error: constraintsError } = useQuery({
    queryKey: ['constraintsFile', constraintsFile, dataBaseUrl, jsonFiles.length],
    queryFn: async () => {
      if (!constraintsFile || !dataBaseUrl) {
        console.log('⚠️ Skipping fetch - no constraintsFile or dataBaseUrl', { constraintsFile, dataBaseUrl });
        return [];
      }
      const url = `${dataBaseUrl}/${constraintsFile}`;
      console.log('📥 Fetching constraints from:', url);
      const res = await fetch(`${url}?_=${Date.now()}`);
      if (!res.ok) {
        console.error('❌ Failed to fetch constraints, status:', res.status);
        return [];
      }
      const data = await res.json();
      console.log('📄 Constraints data structure:', Object.keys(data), 'constraints array length:', data.constraints?.length);
      // Extract labels from constraint objects - handle both array and object with constraints key
      let labels = [];
      if (Array.isArray(data)) {
        labels = data.map(c => c.label).filter(Boolean);
      } else if (data.constraints && Array.isArray(data.constraints)) {
        labels = data.constraints.map(c => c.label).filter(Boolean);
      }
      console.log('✅ Extracted labels:', labels);
      return labels;
    },
    enabled: !!constraintsFile && !!dataBaseUrl,
  });

  const setSubEntityFile = (hint, value) => {
    setForm(f => ({
      ...f,
      kb_sub_entity_files: { ...(f.kb_sub_entity_files || {}), [hint]: value },
    }));
  };

  const saveMutation = useMutation({
    mutationFn: (data) =>
      globalConfig
        ? base44.entities.GlobalConfig.update(globalConfig.id, data)
        : base44.entities.GlobalConfig.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['globalConfig'] });
      toast({ title: 'Saved', description: 'KB User configuration updated.' });
    },
  });

  const prMutation = useMutation({
    mutationFn: async (data) => {
      // Convert badge mappings (sections) to YAML format
      const yamlContent = (data.badge_mappings || []).map(section => {
        let yaml = `- context: "${section.name || 'User'}"\n`;
        if (section.rows && section.rows.length > 0) {
          yaml += section.rows.map(row => 
            ` \- profileBadge: "${row.profileBadge || ''}"\n  contextBadge: "${row.contextBadge || ''}"\n  colour: ${row.colour || 'muted'}\n  constraintMapping: "${row.constraintMapping || ''}"`
          ).join('\n');
        }
        return yaml;
      }).join('\n');
      
      // Derive repo/branch from the folder URL if not in form
      const repoMatch = folderUrl.match(/github\.com\/([^/]+\/[^/]+)\//);
      const repoFromUrl = repoMatch ? repoMatch[1] : null;
      const branchFromUrl = folderUrl.match(/\/tree\/([^/]+)\//)?.[1] || 'main';
      
      console.log('Derived from URL:', { repoFromUrl, branchFromUrl, folderUrl, repoMatch });
      
      const payload = {
        file_path: data.badge_mapping_file,
        file_content: yamlContent,
        message: 'Update badge mappings',
        repo: form.github_repo || repoFromUrl,
        branch: form.github_branch || branchFromUrl,
      };
      
      console.log('Submitting PR with payload:', payload);
      
      const res = await base44.functions.invoke('submitPolicyPR', payload);
      return res;
    },
    onSuccess: (data) => {
      toast({ 
        title: 'Pull Request Created', 
        description: data?.pr_url ? `PR #${data.pr_number} created` : 'Badge mappings saved to GitHub.' 
      });
    },
    onError: (error) => {
      console.error('PR creation error:', error);
      toast({ 
        title: 'Failed to Create PR', 
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive'
      });
    },
  });

  const handleSave = () => {
    // Extract github_repo and github_branch from the parsed URL
    const githubInfo = parsed ? {
      github_repo: folderUrl.match(/github\.com\/([^/]+)\/([^/]+)\//)?.slice(1, 3).join('/'),
      github_branch: folderUrl.match(/\/tree\/([^/]+)\//)?.[1] || 'main',
    } : {};
    
    console.log('💾 Saving badge_mappings:', form.badge_mappings);
    
    saveMutation.mutate({
      ...form,
      kb_sub_entity_files: form.kb_sub_entity_files || {},
      badge_mapping_file: form.badge_mapping_file,
      badge_mappings: form.badge_mappings,
      ...(parsed ? { kb_search_data_api_url: parsed.apiUrl, kb_search_data_url: parsed.rawUrl, ...githubInfo } : {}),
    });
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">KB User Configuration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure the data repository and file assignments for KB Search.
          </p>
        </div>
        <Button variant="outline" onClick={handleSave} disabled={saveMutation.isPending} className="gap-1.5">
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {/* Repository root path */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4" /> Data Repository
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Paste the GitHub folder URL from your browser — the API endpoints are derived automatically.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">GitHub Folder URL</Label>
            <Input
              className="bg-muted/50 text-sm font-mono"
              placeholder="https://github.com/owner/repo/tree/branch/path/to/folder"
              value={folderUrl}
              onChange={e => setFolderUrl(e.target.value)}
            />
          </div>

          {folderUrl && !parsed && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              URL not recognised — expected: https://github.com/owner/repo/tree/branch/path
            </div>
          )}

          {parsed && (
            <div className="rounded-md bg-muted/30 border border-border/40 px-3 py-2 space-y-1">
              <p className="text-xs text-muted-foreground mb-1">Derived endpoints:</p>
              <p className="text-xs font-mono text-foreground/60 break-all">API: {parsed.apiUrl}</p>
              <p className="text-xs font-mono text-foreground/60 break-all">Raw: {parsed.rawUrl}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File assignments */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <FileJson className="w-4 h-4" /> File Assignments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {filesLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading files from repository…
            </div>
          )}
          {!filesLoading && jsonFiles.length === 0 && apiUrl && (
            <p className="text-xs text-muted-foreground">No JSON files found. Check your folder URL above.</p>
          )}
          {!filesLoading && !apiUrl && (
            <p className="text-xs text-muted-foreground">Enter a GitHub folder URL above to browse available files.</p>
          )}
          {filesError && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Failed to load files: {filesError.message}
            </div>
          )}

          {jsonFiles.length > 0 && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Policy File</Label>
                <Select
                  value={form.kb_policy_file || ''}
                  onValueChange={val => setForm(f => ({ ...f, kb_policy_file: val }))}
                >
                  <SelectTrigger className="bg-muted/50 text-sm font-mono">
                    <SelectValue placeholder="Select policy file…" />
                  </SelectTrigger>
                  <SelectContent>
                    {jsonFiles.map(f => (
                      <SelectItem key={f.name} value={f.name}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t border-border/40 pt-4 space-y-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Sub-entity Files</p>
                {SUB_ENTITY_HINTS.map(hint => {
                  const auto = autoDetected[hint];
                  const selected = subEntityFiles[hint] || auto || '';
                  return (
                    <div key={hint} className="space-y-1">
                      <Label className="text-xs text-muted-foreground capitalize">{hint === 'template' ? 'Policy Template' : hint === 'states' ? 'Status Vocabulary' : hint}</Label>
                      <Select value={selected} onValueChange={val => setSubEntityFile(hint, val)}>
                        <SelectTrigger className="bg-muted/50 text-sm font-mono">
                          <SelectValue placeholder={auto ? `Auto: ${auto}` : 'Not detected — select manually'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— None —</SelectItem>
                          {jsonFiles.map(f => (
                            <SelectItem key={f.name} value={f.name}>
                              {f.name}{f.name === auto ? ' (auto-detected)' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* I Want To Cards */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" /> "I Want To…" Dashboard Cards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FeatureCardsEditor />
        </CardContent>
      </Card>

      {/* Badge Mapping */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Tag className="w-4 h-4" /> Badge Mapping
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Map user profile verification statuses to context badge labels, standardise badge colours, and indicate which constraint keys apply to each badge.
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Badge Mapping File Path</Label>
              <Button 
                onClick={() => form.badge_mappings && prMutation.mutate({ badge_mapping_file: form.badge_mapping_file, badge_mappings: form.badge_mappings })} 
                disabled={!form.badge_mapping_file || prMutation.isPending || !form.badge_mappings?.length} 
                size="sm"
                className="h-7 gap-1.5 text-xs"
              >
                <Loader2 className={cn("w-3 h-3", prMutation.isPending && "animate-spin")} />
                {prMutation.isPending ? 'Creating PR…' : 'Submit to GitHub'}
              </Button>
            </div>
            <Input
              className="bg-muted/50 text-sm font-mono"
              placeholder="e.g., .openrel/config/badge-mappings.json"
              value={form.badge_mapping_file || ''}
              onChange={e => setForm(f => ({ ...f, badge_mapping_file: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              GitHub path where badge mappings will be stored. Leave empty to store in GlobalConfig only.
            </p>
          </div>
          {constraintsLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading constraint labels…
            </div>
          )}
          {constraintsError && (
            <p className="text-xs text-destructive">Failed to load constraints: {constraintsError.message}</p>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Badge Mappings Table</Label>
            <BadgeMappingTable
              rows={form.badge_mappings || []}
              onChange={sections => setForm(f => ({ ...f, badge_mappings: sections }))}
              constraintOptions={constraintsData}
              mappingFile={form.badge_mapping_file}
              onMappingFileChange={(val) => setForm(f => ({ ...f, badge_mapping_file: val }))}
              showLoadFromGithub={true}
              githubRepo={form.github_repo}
              githubBranch={form.github_branch || 'main'}
            />
          </div>
          
          {/* YAML Preview */}
          {form.badge_mappings && form.badge_mappings.length > 0 && (
            <Collapsible open={previewOpen} onOpenChange={setPreviewOpen} className="mt-4">
              <div className="flex items-center gap-2">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                    {previewOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <FileJson className="w-3 h-3" />
                    YAML Preview {form.badge_mapping_file && `(${form.badge_mapping_file})`}
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <div className="mt-2 rounded-lg border border-border/40 bg-muted/30 overflow-hidden">
                  <pre className="p-3 text-xs font-mono text-foreground overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap">
                    {(() => {
                      // form.badge_mappings is now an array of sections
                      return (form.badge_mappings || []).map(section => {
                        let yaml = `- context: "${section.name || 'User'}"\n`;
                        if (section.rows && section.rows.length > 0) {
                          yaml += section.rows.map(row => 
                            ` \- profileBadge: "${row.profileBadge || ''}"\n  contextBadge: "${row.contextBadge || ''}"\n  colour: ${row.colour || 'muted'}\n  constraintMapping: "${row.constraintMapping || ''}"`
                          ).join('\n');
                        }
                        return yaml;
                      }).join('\n');
                    })()}
                  </pre>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>
    </div>
  );
}