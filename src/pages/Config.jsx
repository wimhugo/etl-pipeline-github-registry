import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import GitHubConnect from '../components/github/GitHubConnect';
import { Save, Github, FolderGit2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function Config() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: configs = [] } = useQuery({
    queryKey: ['globalConfig'],
    queryFn: () => base44.entities.GlobalConfig.list(),
  });

  const config = configs[0] || {};

  const [form, setForm] = useState({
    github_repo: '',
    github_branch: 'main',
    github_configs_folder: '.openrel/pipelines',
    github_output_folder: 'data',
    namespace: 'openrel',
  });

  useEffect(() => {
    if (config.id) setForm({ ...form, ...config });
  }, [configs.length]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (config.id) return base44.entities.GlobalConfig.update(config.id, data);
      return base44.entities.GlobalConfig.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['globalConfig'] });
      toast({ title: 'Config saved', description: 'Global settings updated.' });
    },
  });

  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuration</h1>
        <p className="text-sm text-muted-foreground mt-1">Global settings for the OpenREL namespace</p>
      </div>

      {/* GitHub Connection */}
      <Card className="p-5 bg-card border-border/50 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <Github className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">GitHub Account</h2>
        </div>
        <GitHubConnect />
      </Card>

      {/* GitHub repo defaults */}
      <Card className="p-5 bg-card border-border/50 space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <FolderGit2 className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Default GitHub Target</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          These defaults apply to all pipelines unless overridden per-pipeline.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Repository (owner/repo)</Label>
            <Input
              value={form.github_repo}
              onChange={e => update('github_repo', e.target.value)}
              placeholder="e.g. myorg/openrel-data"
              className="font-mono text-sm bg-muted/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Default Branch</Label>
            <Input
              value={form.github_branch}
              onChange={e => update('github_branch', e.target.value)}
              className="font-mono text-sm bg-muted/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Pipeline Configs Folder</Label>
            <Input
              value={form.github_configs_folder}
              onChange={e => update('github_configs_folder', e.target.value)}
              placeholder=".openrel/pipelines"
              className="font-mono text-sm bg-muted/50"
            />
            <p className="text-[10px] text-muted-foreground">Where YAML pipeline configs are stored in GitHub</p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Default Output Folder</Label>
            <Input
              value={form.github_output_folder}
              onChange={e => update('github_output_folder', e.target.value)}
              placeholder="data"
              className="font-mono text-sm bg-muted/50"
            />
            <p className="text-[10px] text-muted-foreground">Default folder for pipeline output files</p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Namespace</Label>
            <Input
              value={form.namespace}
              onChange={e => update('namespace', e.target.value)}
              className="font-mono text-sm bg-muted/50"
            />
          </div>
        </div>
      </Card>

      <Button
        onClick={() => saveMutation.mutate(form)}
        disabled={saveMutation.isPending}
        className="gap-2 bg-primary hover:bg-primary/90"
      >
        <Save className="w-4 h-4" />
        {saveMutation.isPending ? 'Saving…' : 'Save Config'}
      </Button>
    </div>
  );
}