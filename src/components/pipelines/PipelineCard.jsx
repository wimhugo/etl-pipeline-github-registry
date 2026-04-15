import React from 'react';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import StatusBadge from '../shared/StatusBadge';
import SourceIcon from '../shared/SourceIcon';
import { ArrowRight, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function PipelineCard({ pipeline }) {
  return (
    <Link to={`/pipelines/${pipeline.id}`}>
      <Card className="p-5 bg-card border-border/50 hover:border-primary/30 transition-all duration-300 cursor-pointer group">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold group-hover:text-primary transition-colors">{pipeline.name}</h3>
            {pipeline.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{pipeline.description}</p>
            )}
          </div>
          <StatusBadge status={pipeline.status} />
        </div>

        {/* Source → Destination flow */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted/50 text-xs font-mono">
            <SourceIcon type={pipeline.source_type} className="w-3.5 h-3.5 text-muted-foreground" />
            {pipeline.source_type}
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted/50 text-xs font-mono">
            <SourceIcon type={pipeline.destination_type} className="w-3.5 h-3.5 text-muted-foreground" />
            {pipeline.destination_type}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="font-mono">{pipeline.schedule || 'manual'}</span>
          <span>•</span>
          <span>{pipeline.total_runs || 0} runs</span>
          {pipeline.success_rate > 0 && (
            <>
              <span>•</span>
              <span className="text-accent">{pipeline.success_rate}% success</span>
            </>
          )}
          {pipeline.last_run_at && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(pipeline.last_run_at), 'MMM d')}
              </span>
            </>
          )}
        </div>
      </Card>
    </Link>
  );
}