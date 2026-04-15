import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Github, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const CONNECTOR_ID = "69df39dd7a73e4638d15ccef";

export default function GitHubConnect({ onConnected }) {
  const [status, setStatus] = useState('checking'); // checking | connected | disconnected

  const checkConnection = async () => {
    setStatus('checking');
    try {
      const res = await base44.functions.invoke('githubFiles', { action: 'listRepos' });
      if (res.data?.repos) {
        setStatus('connected');
        onConnected?.(true);
      } else {
        setStatus('disconnected');
        onConnected?.(false);
      }
    } catch {
      setStatus('disconnected');
      onConnected?.(false);
    }
  };

  useEffect(() => { checkConnection(); }, []);

  const handleConnect = async () => {
    const url = await base44.connectors.connectAppUser(CONNECTOR_ID);
    const popup = window.open(url, '_blank');
    const timer = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(timer);
        checkConnection();
      }
    }, 500);
  };

  const handleDisconnect = async () => {
    await base44.connectors.disconnectAppUser(CONNECTOR_ID);
    setStatus('disconnected');
    onConnected?.(false);
  };

  if (status === 'checking') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Checking GitHub connection...
      </div>
    );
  }

  if (status === 'connected') {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-accent">
          <CheckCircle2 className="w-4 h-4" />
          GitHub connected
        </div>
        <Button size="sm" variant="ghost" onClick={handleDisconnect} className="text-muted-foreground text-xs h-7">
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={handleConnect} className="gap-2 bg-secondary hover:bg-secondary/80">
      <Github className="w-4 h-4" />
      Connect GitHub
    </Button>
  );
}