import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Microscope, Link2, Type, File, CheckCircle2, AlertCircle, Copy, Pencil, Trash2, Clock, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const INPUT_ICONS = { url: Link2, text: Type, file: File };

const OA_STEPS = [
  { id: 'content-source', label: 'Content Source' },
  { id: 'run-analysis',   label: 'Run Analysis' },
];

export default function ObjectAnalysisCard({ analysis, onOpen, onEdit, onCopy, onDelete }) {
  const result = analysis.analysis_result;
  const Icon = INPUT_ICONS[analysis.input_type] || Link2;

  const sourceLabel = analysis.input_type === 'url'
    ? analysis.object_url
    : analysis.input_type === 'text'
      ? 'Text input'
      : 'Uploaded file';

  return (
    <Card className="bg-card border-border/50 flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-md bg-primary/10">
              <Microscope className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold truncate">{analysis.name}</CardTitle>
              {analysis.description && (
                <CardDescription className="text-xs mt-0.5 truncate">{analysis.description}</CardDescription>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" className="h-7 px-3 text-xs gap-1.5" onClick={() => onOpen(analysis)}>
              <Play className="w-3 h-3" /> Open
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(analysis)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onCopy(analysis)}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(analysis)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        {/* Source */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate font-mono">{sourceLabel || '—'}</span>
        </div>

        {/* Result summary */}
        {result ? (
          <div className={cn(
            "rounded-md px-3 py-2 text-xs flex items-center gap-2",
            result.hasRules ? "bg-accent/10 text-accent" : "bg-muted/30 text-muted-foreground"
          )}>
            {result.hasRules
              ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
            <span className="line-clamp-2">{result.summary}</span>
          </div>
        ) : (
          <div className="rounded-md px-3 py-2 text-xs bg-muted/20 text-muted-foreground italic">
            Not yet analysed
          </div>
        )}

        {/* Badges row */}
        {result && (
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={result.hasRules ? "default" : "secondary"} className="text-xs">Rules {result.hasRules ? '✓' : '–'}</Badge>
            <Badge variant={result.hasActions ? "default" : "secondary"} className="text-xs">Actions {result.hasActions ? '✓' : '–'}</Badge>
            <Badge variant={result.hasConstraints ? "default" : "secondary"} className="text-xs">Constraints {result.hasConstraints ? '✓' : '–'}</Badge>
          </div>
        )}

        {/* Last run */}
        {analysis.last_analysed_at && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Analysed {formatDistanceToNow(new Date(analysis.last_analysed_at), { addSuffix: true })}</span>
          </div>
        )}

        {/* Step pills */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {OA_STEPS.map((step, i) => (
            <span
              key={step.id}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground border border-border/40"
            >
              <span className="text-[9px] font-bold">{i + 1}</span>
              {step.label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}