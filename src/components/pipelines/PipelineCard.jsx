import React from 'react';
import { Card } from '@/components/ui/card';
import { Link, useNavigate } from 'react-router-dom';
import StatusBadge from '../shared/StatusBadge';
import { ArrowRight, FileText, Github, Clock, Copy, Trash2, Pencil } from 'lucide-react';
import { format } from 'date-fns';

export default function PipelineCard({ pipeline, onEdit, onCopy, onDelete }) {
  const navigate = useNavigate();
  const hasSource = pipeline.source_file_name;
  const hasTemplate = pipeline.template_file_name;
  const mappingCount = Object.keys(pipeline.field_mapping || {}).length;
  const hasGithub = pipeline.github_repo;

  const handleAction = (e, fn) => {
    e.preventDefault();
    e.stopPropagation();
    fn(pipeline);
  };

  return (
    <div
      className="cursor-pointer"
      onClick={() => navigate(`/pipelines/${pipeline.id}`)}
    >
      <Card className="p-5 bg-card border-border/50 hover:border-primary/30 transition-all duration-300 group">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="text-sm font-semibold font-mono group-hover:text-primary transition-colors truncate">
              {pipeline.name}
            </h3>
            {pipeline.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{pipeline.description}</p>
            )}
          </div>
          <StatusBadge status={pipeline.status} />
        </div>

        {/* Pipeline flow */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono ${hasSource ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'}`}>
            <FileText className="w-3 h-3" />
            {hasSource ? pipeline.source_file_name.split('.').pop().toUpperCase() : 'No source'}
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono ${hasTemplate ? 'bg-accent/10 text-accent' : 'bg-muted/50 text-muted-foreground'}`}>
            <FileText className="w-3 h-3" />
            {hasTemplate ? 'JSON-LD' : 'No template'}
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono ${hasGithub ? 'bg-secondary text-foreground' : 'bg-muted/50 text-muted-foreground'}`}>
            <Github className="w-3 h-3" />
            {hasGithub ? pipeline.github_repo.split('/')[1] : 'No repo'}
          </div>
        </div>

        {/* Footer: stats + actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="font-mono">{pipeline.schedule || 'manual'}</span>
            {mappingCount > 0 && <span className="text-accent">{mappingCount} mappings</span>}
            <span>{pipeline.total_runs || 0} runs</span>
            {pipeline.last_run_at && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(pipeline.last_run_at), 'MMM d')}
              </span>
            )}
          </div>

          {/* Action icons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => handleAction(e, onEdit)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => handleAction(e, onCopy)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors"
              title="Duplicate"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => handleAction(e, onDelete)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}