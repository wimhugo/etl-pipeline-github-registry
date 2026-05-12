import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useRole } from '@/lib/RoleContext';
import RolePermissionsEditor from '@/components/settings/RolePermissionsEditor';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useProject } from '@/lib/ProjectContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, FolderOpen, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function Config() {
  const { activeRole } = useRole();
  const { activeProject, projects } = useProject();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({});

  // Load globalConfig as fallback when no project
  const { data: globalConfigs = [] } = useQuery({
    queryKey: ['globalConfig'],
    queryFn: () => base44.entities.GlobalConfig.list(),
  });
  const globalConfig = globalConfigs[0];

  // Populate form from active project or globalConfig
  useEffect(() => {
    if (activeProject) {
      setForm({ ...activeProject });
    } else if (globalConfig) {
      setForm({ ...globalConfig });
    } else {
      setForm({});
    }
  }, [activeProject?.id, globalConfig?.id]);

  const updateProjectMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.update(activeProject.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: 'Saved', description: 'Project settings updated.' });
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: 'Project created', description: 'Your first project has been created.' });
    },
  });

  const updateGlobalMutation = useMutation({
    mutationFn: (data) =>
      globalConfig
        ? base44.entities.GlobalConfig.update(globalConfig.id, data)
        : base44.entities.GlobalConfig.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['globalConfig'] });
      toast({ title: 'Saved', description: 'Global config updated.' });
    },
  });

  const handleSave = () => {
    if (activeProject) {
      updateProjectMutation.mutate(form);
    } else if (projects.length === 0) {
      // No projects at all — save as global config
      updateGlobalMutation.mutate(form);
    } else {
      updateGlobalMutation.mutate(form);
    }
  };

  const isPending = updateProjectMutation.isPending || updateGlobalMutation.isPending || createProjectMutation.isPending;

  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState(null);
  const [availableRepos, setAvailableRepos] = useState([]);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    setAvailableRepos([]);
    try {
      const res = await base44.functions.invoke('githubFiles', {
        action: 'listRepos',
        github_token: form.github_token,
      });
      if (res.data?.repos) {
        setAvailableRepos(res.data.repos);
        setConnectionResult({ ok: true, message: `Connected! Found ${res.data.repos.length} repositories.` });
      } else {
        setConnectionResult({ ok: false, message: res.data?.error || 'No repos returned.' });
      }
    } catch (err) {
      setConnectionResult({ ok: false, message: err.message });
    }
    setTestingConnection(false);
  };

  const field = (key, label, placeholder, type = 'input') => (
    <div className="space-y-1.5" key={key}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {type === 'textarea' ? (
        <Textarea
          className="bg-muted/50 text-sm font-mono h-20"
          placeholder={placeholder}
          value={form[key] || ''}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        />
      ) : (
        <Input
          className="bg-muted/50 text-sm font-mono"
          placeholder={placeholder}
          value={form[key] || ''}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {activeProject ? `Project: ${activeProject.name}` : 'Global Settings'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeProject
              ? 'Configure GitHub credentials and defaults for this project.'
              : 'No project selected — editing global fallback config.'}
          </p>
        </div>
        <Button onClick={handleSave} disabled={isPending} className="gap-1.5">
          <Save className="w-4 h-4" />
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <FolderOpen className="w-4 h-4" /> Project Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {field('name', 'Project Name', 'My Project')}
          {field('description', 'Description', 'What this project is for…', 'textarea')}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Technology Readiness Level (TRL 1–9)</Label>
            <Select
              value={form.trl ? String(form.trl) : ''}
              onValueChange={(val) => setForm(f => ({ ...f, trl: Number(val) }))}
            >
              <SelectTrigger className="bg-muted/50 text-sm font-mono">
                <SelectValue placeholder="Select TRL…" />
              </SelectTrigger>
              <SelectContent>
                {[1,2,3,4,5,6,7,8,9].map(n => (
                  <SelectItem key={n} value={String(n)}>TRL {n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {field('github_code_repo', 'Code Repository URL', 'https://github.com/org/openrel')}
        </CardContent>
      </Card>

      {activeRole === 'Administrator' && <RolePermissionsEditor />}

      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">KB Search Data Source</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Configure the GitHub folder used by KB User Search to browse policy files.
          </p>
          {field('kb_search_data_api_url', 'GitHub API URL (for file listing)', 'https://api.github.com/repos/owner/repo/contents/path')}
          {field('kb_search_data_url', 'Raw Content Base URL (for file reading)', 'https://raw.githubusercontent.com/owner/repo/branch/path')}
        </CardContent>
      </Card>

      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">GitHub Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {field('github_token', 'Personal Access Token', 'ghp_...')}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testingConnection || !form.github_token?.trim()}
              className="gap-1.5"
            >
              {testingConnection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Test Connection
            </Button>
            {connectionResult && (
              <span className={`flex items-center gap-1.5 text-sm ${connectionResult.ok ? 'text-accent' : 'text-destructive'}`}>
                {connectionResult.ok
                  ? <CheckCircle2 className="w-4 h-4" />
                  : <XCircle className="w-4 h-4" />}
                {connectionResult.message}
              </span>
            )}
          </div>
          {field('github_username', 'GitHub Username', 'my-username')}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Default Repository</Label>
            {availableRepos.length > 0 ? (
              <Select
                value={form.github_repo || ''}
                onValueChange={(val) => setForm(f => ({ ...f, github_repo: val }))}
              >
                <SelectTrigger className="bg-muted/50 text-sm font-mono">
                  <SelectValue placeholder="Select a repository…" />
                </SelectTrigger>
                <SelectContent>
                  {availableRepos.map(r => (
                    <SelectItem key={r.full_name} value={r.full_name}>
                      {r.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                className="bg-muted/50 text-sm font-mono"
                placeholder="owner/repo — or test connection to pick from a list"
                value={form.github_repo || ''}
                onChange={e => setForm(f => ({ ...f, github_repo: e.target.value }))}
              />
            )}
          </div>
          {field('github_branch', 'Default Branch', 'main')}
          {field('github_configs_folder', 'Configs Folder', '.openrel/pipelines')}
          {field('github_output_folder', 'Output Folder', 'data')}
        </CardContent>
      </Card>
    </div>
  );
}