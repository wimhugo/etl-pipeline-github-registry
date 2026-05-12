import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import PolicyCard from '@/components/kbsearch/PolicyCard';
import { Link } from 'react-router-dom';

export default function KBSearch() {
  const [searchQuery, setSearchQuery] = useState('');

  // Load global config
  const { data: globalConfigs = [] } = useQuery({
    queryKey: ['globalConfig'],
    queryFn: () => base44.entities.GlobalConfig.list(),
  });
  const config = globalConfigs[0] || {};
  const apiUrl = config.kb_search_data_api_url || 'https://api.github.com/repos/wimhugo/openrel/contents/data/input/v0.3';
  const rawBaseUrl = config.kb_search_data_url || 'https://raw.githubusercontent.com/wimhugo/openrel/main/data/input/v0.3';

  // Get the file list to resolve auto-detected policy file
  const { data: fileList = [] } = useQuery({
    queryKey: ['kbSearchFiles', apiUrl],
    queryFn: async () => {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error('Failed to fetch file list');
      return res.json();
    },
    enabled: !!apiUrl,
  });
  const jsonFiles = fileList.filter(f => f.name?.toLowerCase().endsWith('.json'));
  const autoPolicy = jsonFiles.find(f => f.name.toLowerCase().includes('polic'))?.name || jsonFiles[0]?.name || '';
  const selectedFile = config.kb_policy_file || autoPolicy;

  // Fetch selected file content
  const { data: fileData, isLoading: fileLoading, error: fileError } = useQuery({
    queryKey: ['kbFileContent', rawBaseUrl, selectedFile],
    queryFn: async () => {
      const res = await fetch(`${rawBaseUrl}/${selectedFile}`);
      if (!res.ok) throw new Error('Failed to fetch file');
      return res.json();
    },
    enabled: !!selectedFile && !!rawBaseUrl,
  });

  const policies = fileData?.policies || (Array.isArray(fileData) ? fileData : []);

  const filtered = policies.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (p.label || '').toLowerCase().includes(q) || (p.id || '').toLowerCase().includes(q);
  });

  const noConfig = !apiUrl || !rawBaseUrl;

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Policy Search</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse and explore policies from the knowledge base data files.
        </p>
      </div>

      {noConfig && (
        <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          No data source configured. Go to{' '}
          <Link to="/kb-user/configuration" className="text-primary underline underline-offset-2">Configuration</Link>{' '}
          to set up your repository URL and file assignments.
        </div>
      )}

      {!noConfig && selectedFile && (
        <p className="text-xs text-muted-foreground">
          Using file: <span className="font-mono">{selectedFile}</span>
        </p>
      )}

      {policies.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 bg-muted/50 text-sm"
            placeholder="Filter by label or id…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {fileLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading policies…
        </div>
      )}

      {fileError && (
        <div className="text-sm text-destructive py-4">
          Failed to load file: {fileError.message}
        </div>
      )}

      {!fileLoading && !fileError && filtered.length === 0 && selectedFile && (
        <div className="text-sm text-muted-foreground py-8 text-center">
          {searchQuery ? 'No policies match your search.' : 'No policies found in this file.'}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((policy) => (
          <PolicyCard key={policy.id} policy={policy} />
        ))}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {filtered.length} of {policies.length} policies
        </p>
      )}
    </div>
  );
}