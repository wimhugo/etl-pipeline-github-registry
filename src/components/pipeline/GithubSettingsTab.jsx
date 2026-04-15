import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CloudUpload, CheckCircle2, ExternalLink } from 'lucide-react';

export default function GithubSettingsTab({ pipeline, onUpdate, globalConfig }) {
  const [repos, setRepos] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const fetchRepos = async () => {
    const res = await base44.functions.invoke('githubFiles', { action: 'listRepos' });
    if (res.data?.repos) setRepos(res.data.repos);
  };

  useEffect(() => { fetchRepos(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    const res = await base44.functions.invoke('syncConfigToGithub', {
      pipeline_id: pipeline.id,
      repo: pipeline.github_repo || globalConfig?.github_repo,
      branch: pipeline.github_branch || globalConfig?.github_branch || 'main',
      configs_folder: globalConfig?.github_configs_folder || '.openrel/pipelines',
    });
    setSyncing(false);
    setSyncResult(res.data);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">Repository</Label>
          {repos.length > 0 ? (
            <Select
              value={pipeline.github_repo || ''}
              onValueChange={v => onUpdate({ github_repo: v })}
            >
              <SelectTrigger className="bg-muted/50 font-mono text-sm">
                <SelectValue placeholder="Select repo" />
              </SelectTrigger>
              <SelectContent>
                {repos.map(r => (
                  <SelectItem key={r.full_name} value={r.full_name} className="font-mono text-sm">
                    {r.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={pipeline.github_repo || globalConfig?.github_repo || ''}
              onChange={e => onUpdate({ github_repo: e.target.value })}
              placeholder="owner/repo"
              className="font-mono text-sm bg-muted/50"
            />
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Branch</Label>
          <Input
            value={pipeline.github_branch || globalConfig?.github_branch || 'main'}
            onChange={e => onUpdate({ github_branch: e.target.value })}
            className="font-mono text-sm bg-muted/50"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label className="text-xs">Target Folder in Repo</Label>
          <Input
            value={pipeline.github_target_folder || globalConfig?.github_output_folder || ''}
            onChange={e => onUpdate({ github_target_folder: e.target.value })}
            placeholder="e.g. data/openrel"
            className="font-mono text-sm bg-muted/50"
          />
        </div>
      </div>

      {/* Output inventory */}
      {pipeline.output_inventory?.length > 0 && (
        <div>
          <Label className="text-xs">Output File Inventory</Label>
          <div className="mt-2 space-y-1">
            {pipeline.output_inventory.map(f => (
              <div key={f} className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                <CheckCircle2 className="w-3 h-3 text-accent" /> {f}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Config path */}
      {pipeline.github_config_path && (
        <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
          <p className="text-xs text-muted-foreground">Config synced to:</p>
          <p className="text-xs font-mono text-accent mt-0.5">{pipeline.github_config_path}</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button
          onClick={handleSync}
          disabled={syncing || !pipeline.github_repo}
          className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
          Sync Config to GitHub
        </Button>
        {syncResult?.url && (
          <a href={syncResult.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80">
            <ExternalLink className="w-3.5 h-3.5" /> View on GitHub
          </a>
        )}
      </div>
    </div>
  );
}