import React from 'react';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import StatusBadge from '../shared/StatusBadge';
import { ArrowRight, Clock, FileText, Github, GitBranch } from 'lucide-react';
import { format } from 'date-fns';

export default function PipelineCard({ pipeline }) {
  const hasSource = pipeline.source_file_name;
  const hasTemplate = pipeline.template_file_name;
  const mappingCount = Object.keys(pipeline.field_mapping || {}).length;
  const hasGithub = pipeline.github_repo;

  return (
    <Link to={`/pipelines/${pipeline.id}`}>
      <Card className="p-5 bg-card border-border/50 hover:border-primary/30 transition-all duration-300 cursor-pointer group">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold font-mono group-hover:text-primary transition-colors">{pipeline.name}</h3>
            {pipeline.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{pipeline.description}</p>
            )}
          </div>
          <StatusBadge status={pipeline.status} />
        </div>

        {/* Pipeline flow indicators */}
        <div className="flex items-center gap-2 mb-4">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono ${hasSource ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'}`}>
            <FileText className="w-3 h-3" />
            {hasSource ? pipeline.source_file_name.split('.').pop().toUpperCase() : 'No source'}
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono ${hasTemplate ? 'bg-accent/10 text-accent' : 'bg-muted/50 text-muted-foreground'}`}>
            <FileText className="w-3 h-3" />
            {hasTemplate ? 'JSON-LD' : 'No template'}
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono ${hasGithub ? 'bg-secondary text-foreground' : 'bg-muted/50 text-muted-foreground'}`}>
            <Github className="w-3 h-3" />
            {hasGithub ? pipeline.github_repo.split('/')[1] : 'No repo'}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span className="font-mono">{pipeline.schedule || 'manual'}</span>
          {mappingCount > 0 && <span className="text-accent">{mappingCount} mappings</span>}
          <span>{pipeline.total_runs || 0} runs</span>
          {pipeline.success_rate > 0 && <span className="text-accent">{pipeline.success_rate}% success</span>}
          {pipeline.last_run_at && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {format(new Date(pipeline.last_run_at), 'MMM d')}
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}