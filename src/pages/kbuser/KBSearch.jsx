import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, FileJson, Search } from 'lucide-react';
import PolicyCard from '@/components/kbsearch/PolicyCard';

const SUB_ENTITY_HINTS = ['actions', 'constraints', 'agents', 'sources', 'scenarios'];

function isPolicyFile(filename) {
  return filename.toLowerCase().endsWith('.json') &&
    !['readme', 'normalization', 'example'].some(s => filename.toLowerCase().includes(s));
}

function fileHint(filename) {
  const lower = filename.toLowerCase();
  for (const hint of SUB_ENTITY_HINTS) {
    if (lower.includes(hint)) return hint;
  }
  return null;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

export default function KBSearch() {
  const [selectedFile, setSelectedFile] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Load config for data URL
  const { data: globalConfigs = [] } = useQuery({
    queryKey: ['globalConfig'],
    queryFn: () => base44.entities.GlobalConfig.list(),
  });
  const config = globalConfigs[0] || {};
  const apiUrl = config.kb_search_data_api_url || 'https://api.github.com/repos/wimhugo/openrel/contents/data/input/v0.3';
  const rawBaseUrl = config.kb_search_data_url || 'https://raw.githubusercontent.com/wimhugo/openrel/main/data/input/v0.3';

  // List files in the data folder
  const { data: fileList = [], isLoading: filesLoading } = useQuery({
    queryKey: ['kbSearchFiles', apiUrl],
    queryFn: () => fetchJson(apiUrl),
    enabled: !!apiUrl,
  });

  const jsonFiles = fileList.filter(f => f.name.toLowerCase().endsWith('.json') && f.name.toLowerCase() !== 'readme.md');

  // Auto-select first policy-looking file
  useEffect(() => {
    if (!selectedFile && jsonFiles.length > 0) {
      const policyFile = jsonFiles.find(f => f.name.toLowerCase().includes('polic')) || jsonFiles[0];
      setSelectedFile(policyFile.name);
    }
  }, [jsonFiles.length]);

  // Fetch selected file content
  const { data: fileData, isLoading: fileLoading, error: fileError } = useQuery({
    queryKey: ['kbFileContent', rawBaseUrl, selectedFile],
    queryFn: () => fetchJson(`${rawBaseUrl}/${selectedFile}`),
    enabled: !!selectedFile && !!rawBaseUrl,
  });

  // Extract policies array from the file
  const policies = fileData?.policies || (Array.isArray(fileData) ? fileData : []);

  // Filter by search
  const filtered = policies.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (p.label || '').toLowerCase().includes(q) ||
      (p.id || '').toLowerCase().includes(q)
    );
  });

  // Classify files by sub-entity hint
  const subEntityFiles = {};
  for (const hint of SUB_ENTITY_HINTS) {
    const match = jsonFiles.filter(f => fileHint(f.name) === hint);
    if (match.length) subEntityFiles[hint] = match.map(f => f.name);
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Policy Search</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse and explore policies from the knowledge base data files.
        </p>
      </div>

      {/* File picker + sub-entity hints */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">Data file</label>
          {filesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading files…
            </div>
          ) : (
            <Select value={selectedFile} onValueChange={setSelectedFile}>
              <SelectTrigger className="bg-muted/50 text-sm">
                <SelectValue placeholder="Select a file…" />
              </SelectTrigger>
              <SelectContent>
                {jsonFiles.map(f => (
                  <SelectItem key={f.name} value={f.name}>
                    <span className="flex items-center gap-2">
                      <FileJson className="w-3.5 h-3.5 text-muted-foreground" />
                      {f.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Sub-entity file hints */}
        {Object.keys(subEntityFiles).length > 0 && (
          <div className="sm:w-64 space-y-1">
            <label className="text-xs text-muted-foreground">Sub-entity files detected</label>
            <div className="rounded-md border border-border/50 bg-muted/20 px-3 py-2 space-y-0.5">
              {Object.entries(subEntityFiles).map(([hint, files]) => (
                <div key={hint} className="flex items-center gap-2 text-xs">
                  <span className="capitalize text-muted-foreground w-20 shrink-0">{hint}:</span>
                  <span className="font-mono text-foreground/80 truncate">{files.join(', ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search bar */}
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

      {/* Policy cards */}
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