import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import StatCard from '../components/shared/StatCard';
import RunsChart from '../components/dashboard/RunsChart';
import RecentRunsTable from '../components/dashboard/RecentRunsTable';
import ProjectSelector from '../components/project/ProjectSelector';
import { useProject } from '@/lib/ProjectContext';
import { GitBranch, Play, CheckCircle2, AlertTriangle } from 'lucide-react';
import ProjectInfoPanel from '../components/dashboard/ProjectInfoPanel';

export default function Dashboard() {
  const { activeProject } = useProject();

  const { data: allPipelines = [] } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => base44.entities.Pipeline.list('-created_date'),
  });

  const { data: runs = [] } = useQuery({
    queryKey: ['runs'],
    queryFn: () => base44.entities.PipelineRun.list('-started_at', 50),
  });

  // Filter by active project; pipelines without project_id are "legacy" shown when no project selected
  const pipelines = activeProject
    ? allPipelines.filter(p => p.project_id === activeProject.id)
    : allPipelines.filter(p => !p.project_id);

  const pipelineIds = new Set(pipelines.map(p => p.id));
  const filteredRuns = runs.filter(r => pipelineIds.has(r.pipeline_id));

  const activePipelines = pipelines.filter(p => p.status === 'active').length;
  const totalRuns = filteredRuns.length;
  const successRuns = filteredRuns.filter(r => r.status === 'success').length;
  const failedRuns = filteredRuns.filter(r => r.status === 'failed').length;
  const successRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeProject ? activeProject.name : 'Legacy pipelines'} — overview
          </p>
        </div>
        <ProjectSelector />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pipelines"
          value={pipelines.length}
          subtitle={`${activePipelines} active`}
          icon={GitBranch}
        />
        <StatCard
          title="Total Runs"
          value={totalRuns}
          icon={Play}
        />
        <StatCard
          title="Success Rate"
          value={`${successRate}%`}
          subtitle={`${successRuns} passed`}
          icon={CheckCircle2}
          trend={successRate > 80 ? 'Healthy' : undefined}
          trendUp={successRate > 80}
        />
        <StatCard
          title="Failures"
          value={failedRuns}
          icon={AlertTriangle}
          trend={failedRuns > 0 ? `${failedRuns} need attention` : undefined}
          trendUp={false}
        />
      </div>

      {/* Charts & Table */}
      <div className="grid lg:grid-cols-2 gap-6">
        <RunsChart runs={filteredRuns} />
        <RecentRunsTable runs={filteredRuns} />
      </div>

      {/* Project Info */}
      <ProjectInfoPanel project={activeProject} />
    </div>
  );
}