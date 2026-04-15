import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, XCircle, Loader2, Github } from 'lucide-react';

export default function GitHubConnect({ onConnected }) {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    base44.functions.invoke('githubFiles', { action: 'listRepos' })
      .then(res => {
        const ok = !!res.data?.repos;
        setStatus(ok ? 'connected' : 'error');
        onConnected?.(ok);
      })
      .catch(() => {
        setStatus('error');
        onConnected?.(false);
      });
  }, []);

  if (status === 'checking') return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin" /> Checking GitHub connection…
    </div>
  );

  if (status === 'connected') return (
    <div className="flex items-center gap-2 text-sm text-accent">
      <CheckCircle2 className="w-4 h-4" /> GitHub connected via token
    </div>
  );

  return (
    <div className="flex items-center gap-2 text-sm text-destructive">
      <XCircle className="w-4 h-4" />
      GitHub token not working — check your GITHUB_TOKEN secret in settings.
    </div>
  );
}