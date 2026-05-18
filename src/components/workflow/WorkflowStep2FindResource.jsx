import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, Search, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WorkflowStep2FindResource() {
  const [pid, setPid] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleResolvePid = async (e) => {
    e.preventDefault();
    if (!pid.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await base44.functions.invoke('resolvePid', { pid: pid.trim() });
      
      if (response.status !== 200) {
        setError('Failed to resolve PID');
        return;
      }

      setResult({
        pid: pid.trim(),
        redirectURL: response.data.redirectURL
      });
    } catch (err) {
      setError(err.message || 'Failed to resolve PID');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" />
            Find Resource by PID
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter a Persistent Identifier (PID) such as a DOI (10.1000/182) to resolve and find the resource.
          </p>

          <form onSubmit={handleResolvePid} className="space-y-3">
            <Input
              placeholder="Enter PID (e.g., 10.1000/182, urn:nbn:se:uu:diva-123456)"
              value={pid}
              onChange={(e) => setPid(e.target.value)}
              disabled={loading}
              className="bg-muted/50"
            />
            <Button
              type="submit"
              disabled={!pid.trim() || loading}
              className="w-full gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Resolving...' : 'Resolve PID'}
            </Button>
          </form>

          {error && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {result && (
            <div className="space-y-3 p-4 rounded-lg bg-accent/10 border border-accent/20">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="font-medium text-sm text-foreground">PID Resolved</p>
                  <div className="space-y-1.5 text-xs">
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">PID:</span> {result.pid}
                    </p>
                    <a
                      href={result.redirectURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      View Resource
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}