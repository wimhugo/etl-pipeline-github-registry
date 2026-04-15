import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import StatCard from '../components/shared/StatCard';
import RunsChart from '../components/dashboard/RunsChart';
import RecentRunsTable from '../components/dashboard/RecentRunsTable';
import { GitBranch, Play, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function Dashboard() {
  const { data: pipelines = [] } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => base44.entities.Pipeline.list('-created_date'),
  });

  const { data: runs = [] } = useQuery({
    queryKey: ['runs'],
    queryFn: () => base44.entities.PipelineRun.list('-started_at', 50),
  });

  const activePipelines = pipelines.filter(p => p.status === 'active').length;
  const totalRuns = runs.length;
  const successRuns = runs.filter(r => r.status === 'success').length;
  const failedRuns = runs.filter(r => r.status === 'failed').length;
  const successRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          OpenREL namespace overview
        </p>
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
        <RunsChart runs={runs} />
        <RecentRunsTable runs={runs} />
      </div>
    </div>
  );
}