import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Copy, Play, FileJson, Globe, FileText, Loader2, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';

export default function JsonParserCard({ config, onEdit, onDelete, onClone, onExecute, isExecuting }) {
  const inputIcon = config.input_type === 'file' ? <Globe className="w-3.5 h-3.5" /> : <FileJson className="w-3.5 h-3.5" />;
  const executing = isExecuting(config.id);

  const statusIcon = config.last_run_status === 'success' ? (
    <CheckCircle className="w-3.5 h-3.5 text-accent" />
  ) : config.last_run_status === 'failed' ? (
    <XCircle className="w-3.5 h-3.5 text-destructive" />
  ) : (
    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
  );

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">{config.name}</CardTitle>
              <Badge variant={config.is_active ? 'default' : 'secondary'} className="text-[10px]">
                {config.is_active ? 'Active' : 'Inactive'}
              </Badge>
              <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                {inputIcon}
                {config.input_type === 'file' ? 'URL' : 'Text'}
              </Badge>
            </div>
            {config.description && (
              <CardDescription className="text-xs">{config.description}</CardDescription>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => onExecute(config)}
              disabled={executing}
              title="Execute pipeline"
            >
              {executing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => onClone(config)}
              title="Clone configuration"
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => onEdit(config)}
              title="Edit configuration"
            >
              <Edit className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(config)}
              title="Delete configuration"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground">Target:</span>
            <div className="font-mono text-[11px] mt-0.5 truncate">
              {config.github_target_folder || '—'}/{config.github_target_file || '—'}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Branch:</span>
            <div className="font-mono text-[11px] mt-0.5">{config.github_branch || 'main'}</div>
          </div>
          <div>
            <span className="text-muted-foreground flex items-center gap-1">Last Run:</span>
            <div className="flex items-center gap-1 mt-0.5">
              {statusIcon}
              <span className="text-[11px]">
                {config.last_run_at
                  ? new Date(config.last_run_at).toLocaleString()
                  : 'never'}
              </span>
            </div>
          </div>
        </div>
        {config.last_run_message && (
          <div className="mt-3 p-2 rounded bg-muted/50 text-[11px] text-muted-foreground font-mono break-all">
            {config.last_run_message}
          </div>
        )}
        {config.last_pr_url && (
          <a
            href={config.last_pr_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View Pull Request
          </a>
        )}
        {config.input_type === 'text' && config.json_text && (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <FileText className="w-3 h-3" />
            {config.json_text.length} chars of JSON input
          </div>
        )}
        {config.input_type === 'file' && config.input_file_url && (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
            <Globe className="w-3 h-3 shrink-0" />
            <span className="truncate font-mono">{config.input_file_url}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}