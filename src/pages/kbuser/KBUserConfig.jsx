import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Loader2, FileJson, Database, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const SUB_ENTITY_HINTS = ['actions', 'constraints', 'agents', 'sources', 'scenarios'];

function fileHint(filename) {
  const lower = filename.toLowerCase();
  for (const hint of SUB_ENTITY_HINTS) {
    if (lower.includes(hint)) return hint;
  }
  return null;
}

// Parse a standard GitHub browser folder URL into API + raw URLs
function parseGithubFolderUrl(url) {
  try {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/);
    if (!match) return null;
    const [, owner, repo, branch, path] = match;
    return {
      apiUrl: `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      rawUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`,
    };
  } catch {
    return null;
  }
}

// Reconstruct a browser URL from a stored API URL + raw URL
function reconstructBrowserUrl(apiUrl, rawUrl) {
  const m = apiUrl?.match(/api\.github\.com\/repos\/([^/]+)\/([^/]+)\/contents\/(.+)/);
  if (!m) return '';
  const branch = rawUrl?.split('/')[6] || 'main';
  return `https://github.com/${m[1]}/${m[2]}/tree/${branch}/${m[3]}`;
}

export default function KBUserConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({});
  const [folderUrl, setFolderUrl] = useState('');

  const { data: globalConfigs = [] } = useQuery({
    queryKey: ['globalConfig'],
    queryFn: () => base44.entities.GlobalConfig.list(),
  });
  const globalConfig = globalConfigs[0];

  useEffect(() => {
    if (globalConfig) {
      setForm({ ...globalConfig });
      setFolderUrl(reconstructBrowserUrl(
        globalConfig.kb_search_data_api_url,
        globalConfig.kb_search_data_url,
      ));
    }
  }, [globalConfig?.id]);

  const parsed = parseGithubFolderUrl(folderUrl);

  // Use parsed or existing stored API URL to list files
  const apiUrl = parsed?.apiUrl || form.kb_search_data_api_url || '';

  const { data: fileList = [], isLoading: filesLoading } = useQuery({
    queryKey: ['kbSearchFiles', apiUrl],
    queryFn: async () => {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error('Failed to fetch file list');
      return res.json();
    },
    enabled: !!apiUrl,
  });

  const jsonFiles = fileList.filter(f => f.name?.toLowerCase().endsWith('.json'));

  const autoDetected = {};
  for (const hint of SUB_ENTITY_HINTS) {
    const matches = jsonFiles.filter(f => fileHint(f.name) === hint);
    if (matches.length) autoDetected[hint] = matches[0].name;
  }

  const subEntityFiles = form.kb_sub_entity_files || {};

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

  const handleSave = () => {
    saveMutation.mutate({
      ...form,
      ...(parsed ? { kb_search_data_api_url: parsed.apiUrl, kb_search_data_url: parsed.rawUrl } : {}),
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">KB User Configuration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure the data repository and file assignments for KB Search.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-1.5">
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
                      <Label className="text-xs text-muted-foreground capitalize">{hint}</Label>
                      <Select value={selected} onValueChange={val => setSubEntityFile(hint, val)}>
                        <SelectTrigger className="bg-muted/50 text-sm font-mono">
                          <SelectValue placeholder={auto ? `Auto: ${auto}` : 'Not detected — select manually'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>— None —</SelectItem>
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
    </div>
  );
}