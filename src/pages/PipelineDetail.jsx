import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import StatusBadge from '../components/shared/StatusBadge';
import SourceTab from '../components/pipeline/SourceTab';
import TemplateTab from '../components/pipeline/TemplateTab';
import GithubSettingsTab from '../components/pipeline/GithubSettingsTab';
import MappingEditor from '../components/mapping/MappingEditor';
import {
  ArrowLeft, Play, Pause, Trash2, Save, Clock
} from 'lucide-react';
import { format } from 'date-fns';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';

const SCHEDULES = ['manual', 'every_5min', 'every_15min', 'hourly', 'daily', 'weekly'];

export default function PipelineDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [localChanges, setLocalChanges] = useState({});
  const [running, setRunning] = useState(false);

  const { data: pipeline, isLoading } = useQuery({
    queryKey: ['pipeline', id],
    queryFn: async () => {
      const list = await base44.entities.Pipeline.filter({ id });
      return list[0];
    },
  });

  const { data: globalConfigs = [] } = useQuery({
    queryKey: ['globalConfig'],
    queryFn: () => base44.entities.GlobalConfig.list(),
  });
  const globalConfig = globalConfigs[0] || {};

  const { data: runs = [] } = useQuery({
    queryKey: ['pipeline-runs', id],
    queryFn: () => base44.entities.PipelineRun.filter({ pipeline_id: id }, '-started_at', 20),
  });

  const merged = { ...pipeline, ...localChanges };

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Pipeline.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', id] });
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      setLocalChanges({});
      toast({ title: 'Saved', description: 'Pipeline updated.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Pipeline.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pipelines'] }); navigate('/pipelines'); },
  });

  const handleUpdate = (changes) => setLocalChanges(prev => ({ ...prev, ...changes }));
  const handleSave = () => saveMutation.mutate(localChanges);
  const isDirty = Object.keys(localChanges).length > 0;

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await base44.functions.invoke('executePipeline', {
        pipeline_id: id,
        github_token: globalConfig?.github_token,
      });
      queryClient.invalidateQueries({ queryKey: ['pipeline', id] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-runs', id] });
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      toast({
        title: 'Run complete',
        description: res.data?.pr_url
          ? `${res.data.records} records written. PR: ${res.data.pr_url}`
          : `${res.data?.records || 0} records processed.`,
      });
    } catch (err) {
      toast({ title: 'Run failed', description: err.message || 'Check pipeline configuration.', variant: 'destructive' });
    }
    setRunning(false);
  };

  if (isLoading || !pipeline) {
    return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/pipelines')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Pipelines
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold tracking-tight font-mono">{merged.name}</h1>
            <StatusBadge status={merged.status} />
          </div>
          {merged.description && <p className="text-sm text-muted-foreground">{merged.description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isDirty && (
            <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gap-1.5 bg-primary hover:bg-primary/90">
              <Save className="w-3.5 h-3.5" />
              {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => saveMutation.mutate({ status: merged.status === 'active' ? 'paused' : 'active' })}
            className="gap-1.5"
          >
            {merged.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {merged.status === 'active' ? 'Pause' : 'Activate'}
          </Button>
          <Button size="sm" onClick={handleRun} disabled={running} className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5">
            <Play className="w-3.5 h-3.5" />
            {running ? 'Running…' : 'Run Now'}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete pipeline?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete "{pipeline.name}".</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="bg-muted/50 border border-border/50">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="source">Source</TabsTrigger>
          <TabsTrigger value="template">Template</TabsTrigger>
          <TabsTrigger value="mapping">Mapping</TabsTrigger>
          <TabsTrigger value="github">GitHub</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Name</Label>
              <Input value={merged.name || ''} onChange={e => handleUpdate({ name: e.target.value })} className="font-mono text-sm bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Schedule</Label>
              <Select value={merged.schedule || 'manual'} onValueChange={v => handleUpdate({ schedule: v })}>
                <SelectTrigger className="bg-muted/50 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCHEDULES.map(s => <SelectItem key={s} value={s} className="text-sm">{s.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-xs">Description</Label>
              <Textarea value={merged.description || ''} onChange={e => handleUpdate({ description: e.target.value })} className="bg-muted/50 text-sm h-20" />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-2">
            {[
              { label: 'TOTAL RUNS', value: pipeline.total_runs || 0 },
              { label: 'SUCCESS RATE', value: `${pipeline.success_rate || 0}%`, accent: true },
              { label: 'LAST RUN', value: pipeline.last_run_at ? format(new Date(pipeline.last_run_at), 'MMM d, HH:mm') : '—' },
            ].map(s => (
              <Card key={s.label} className="p-4 bg-muted/30 border-border/30">
                <p className={`text-xl font-semibold ${s.accent ? 'text-accent' : ''}`}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{s.label}</p>
              </Card>
            ))}
          </div>

          {/* Recent runs */}
          <Card className="bg-card border-border/50 overflow-hidden">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Recent Runs</CardTitle></CardHeader>
            <CardContent className="px-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border/50">
                  {['Status', 'Extracted', 'Loaded', 'Duration', 'Started'].map(h => (
                    <th key={h} className="text-left px-6 py-2 text-xs text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {runs.slice(0, 8).map(run => (
                    <tr key={run.id} className="border-b border-border/30">
                      <td className="px-6 py-2"><StatusBadge status={run.status} /></td>
                      <td className="px-6 py-2 font-mono text-xs">{(run.records_extracted || 0).toLocaleString()}</td>
                      <td className="px-6 py-2 font-mono text-xs">{(run.records_loaded || 0).toLocaleString()}</td>
                      <td className="px-6 py-2 text-muted-foreground text-xs">{run.duration_seconds ? `${run.duration_seconds}s` : '—'}</td>
                      <td className="px-6 py-2 text-muted-foreground text-xs">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{run.started_at ? format(new Date(run.started_at), 'MMM d, HH:mm') : '—'}</span>
                      </td>
                    </tr>
                  ))}
                  {runs.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground text-xs">No runs yet</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Source */}
        <TabsContent value="source" className="mt-4">
          <Card className="p-6 bg-card border-border/50">
            <SourceTab pipeline={merged} onUpdate={handleUpdate} />
          </Card>
        </TabsContent>

        {/* Template */}
        <TabsContent value="template" className="mt-4">
          <Card className="p-6 bg-card border-border/50">
            <TemplateTab pipeline={merged} onUpdate={handleUpdate} />
          </Card>
        </TabsContent>

        {/* Mapping */}
        <TabsContent value="mapping" className="mt-4">
          <Card className="p-6 bg-card border-border/50">
            <MappingEditor
              sourceFields={merged.source_fields || []}
              templateFields={merged.template_fields || []}
              mapping={merged.field_mapping || {}}
              onChange={(mapping) => handleUpdate({ field_mapping: mapping })}
            />
          </Card>
        </TabsContent>

        {/* GitHub */}
        <TabsContent value="github" className="mt-4">
          <Card className="p-6 bg-card border-border/50">
            <GithubSettingsTab pipeline={merged} onUpdate={handleUpdate} globalConfig={globalConfig} />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}