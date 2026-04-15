import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import StatusBadge from '../components/shared/StatusBadge';
import SourceIcon from '../components/shared/SourceIcon';
import PipelineForm from '../components/pipelines/PipelineForm';
import {
  ArrowLeft, ArrowRight, Play, Pause, Trash2, Pencil, Clock, Hash, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';

export default function PipelineDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);

  const { data: pipeline, isLoading } = useQuery({
    queryKey: ['pipeline', id],
    queryFn: async () => {
      const list = await base44.entities.Pipeline.filter({ id });
      return list[0];
    },
  });

  const { data: runs = [] } = useQuery({
    queryKey: ['pipeline-runs', id],
    queryFn: () => base44.entities.PipelineRun.filter({ pipeline_id: id }, '-started_at', 20),
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Pipeline.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', id] });
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      setShowEdit(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Pipeline.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      navigate('/pipelines');
    },
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      const recordsCount = Math.floor(Math.random() * 5000) + 100;
      const duration = Math.floor(Math.random() * 120) + 5;
      const success = Math.random() > 0.15;

      await base44.entities.PipelineRun.create({
        pipeline_id: id,
        pipeline_name: pipeline.name,
        status: success ? 'success' : 'failed',
        started_at: now,
        completed_at: new Date(Date.now() + duration * 1000).toISOString(),
        records_extracted: recordsCount,
        records_transformed: success ? recordsCount : Math.floor(recordsCount * 0.7),
        records_loaded: success ? recordsCount : 0,
        duration_seconds: duration,
        error_message: success ? '' : 'Connection timeout after 30s',
        logs: success
          ? `[INFO] Extracting ${recordsCount} records\n[INFO] Transform complete\n[INFO] Load complete`
          : `[INFO] Extracting ${recordsCount} records\n[ERROR] Connection timeout`,
      });

      const totalRuns = (pipeline.total_runs || 0) + 1;
      const currentSuccesses = Math.round(((pipeline.success_rate || 0) / 100) * (pipeline.total_runs || 0));
      const newSuccesses = currentSuccesses + (success ? 1 : 0);
      const newRate = Math.round((newSuccesses / totalRuns) * 100);

      await base44.entities.Pipeline.update(id, {
        last_run_at: now,
        last_run_status: success ? 'success' : 'failed',
        total_runs: totalRuns,
        success_rate: newRate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', id] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-runs', id] });
      queryClient.invalidateQueries({ queryKey: ['runs'] });
    },
  });

  if (isLoading || !pipeline) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <button onClick={() => navigate('/pipelines')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Pipelines
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold tracking-tight font-mono">{pipeline.name}</h1>
            <StatusBadge status={pipeline.status} />
          </div>
          {pipeline.description && <p className="text-sm text-muted-foreground">{pipeline.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowEdit(true)} className="gap-1.5">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateMutation.mutate({ status: pipeline.status === 'active' ? 'paused' : 'active' })}
            className="gap-1.5"
          >
            {pipeline.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {pipeline.status === 'active' ? 'Pause' : 'Activate'}
          </Button>
          <Button
            size="sm"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5"
          >
            <Play className="w-3.5 h-3.5" /> Run Now
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" className="gap-1.5">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete pipeline?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete "{pipeline.name}" and cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Pipeline flow + Config */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="bg-card border-border/50 p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Data Flow</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 font-mono text-sm">
              <SourceIcon type={pipeline.source_type} className="w-4 h-4 text-primary" />
              {pipeline.source_type}
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-medium">Transform</div>
            <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 font-mono text-sm">
              <SourceIcon type={pipeline.destination_type} className="w-4 h-4 text-accent" />
              {pipeline.destination_type}
            </div>
          </div>
        </Card>

        <Card className="bg-card border-border/50 p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Schedule</p>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{(pipeline.schedule || 'manual').replace(/_/g, ' ')}</span>
          </div>
          {pipeline.last_run_at && (
            <p className="text-xs text-muted-foreground mt-2">
              Last run: {format(new Date(pipeline.last_run_at), 'MMM d, yyyy HH:mm')}
            </p>
          )}
        </Card>

        <Card className="bg-card border-border/50 p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Statistics</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-lg font-semibold">{pipeline.total_runs || 0}</p>
              <p className="text-[10px] text-muted-foreground">RUNS</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-accent">{pipeline.success_rate || 0}%</p>
              <p className="text-[10px] text-muted-foreground">SUCCESS</p>
            </div>
            <div>
              <p className="text-lg font-semibold">
                {pipeline.last_run_status ? <StatusBadge status={pipeline.last_run_status} /> : '—'}
              </p>
              <p className="text-[10px] text-muted-foreground">LAST</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Transform Logic */}
      {pipeline.transform_logic && (
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Transform Logic</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="font-mono text-xs text-foreground/80 bg-muted/50 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
              {pipeline.transform_logic}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Runs Table */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Run History
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left px-6 py-3 text-xs text-muted-foreground font-medium">Status</th>
                  <th className="text-left px-6 py-3 text-xs text-muted-foreground font-medium">Extracted</th>
                  <th className="text-left px-6 py-3 text-xs text-muted-foreground font-medium">Loaded</th>
                  <th className="text-left px-6 py-3 text-xs text-muted-foreground font-medium">Duration</th>
                  <th className="text-left px-6 py-3 text-xs text-muted-foreground font-medium">Started</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(run => (
                  <tr key={run.id} className="border-b border-border/30">
                    <td className="px-6 py-3"><StatusBadge status={run.status} /></td>
                    <td className="px-6 py-3 font-mono text-xs">{(run.records_extracted || 0).toLocaleString()}</td>
                    <td className="px-6 py-3 font-mono text-xs">{(run.records_loaded || 0).toLocaleString()}</td>
                    <td className="px-6 py-3 text-muted-foreground">{run.duration_seconds ? `${run.duration_seconds}s` : '—'}</td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {run.started_at ? format(new Date(run.started_at), 'MMM d, HH:mm:ss') : '—'}
                    </td>
                  </tr>
                ))}
                {runs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">No runs yet. Click "Run Now" to execute.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <PipelineForm
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSubmit={(data) => updateMutation.mutate(data)}
        initialData={pipeline}
      />
    </div>
  );
}