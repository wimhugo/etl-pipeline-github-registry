import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatusBadge from '../components/shared/StatusBadge';
import EmptyState from '../components/shared/EmptyState';
import { Search, Play, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function Runs() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['runs'],
    queryFn: () => base44.entities.PipelineRun.list('-started_at', 100),
  });

  const filtered = runs.filter(r => {
    const matchSearch = r.pipeline_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline Runs</h1>
        <p className="text-sm text-muted-foreground mt-1">{runs.length} total runs</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by pipeline name..."
            className="pl-9 bg-muted/50 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 bg-muted/50 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-card animate-pulse border border-border/50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Play}
          title={search || statusFilter !== 'all' ? 'No matching runs' : 'No runs yet'}
          description="Pipeline runs will appear here once pipelines are executed."
        />
      ) : (
        <Card className="bg-card border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-xs text-muted-foreground">Pipeline</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Status</TableHead>
                  <TableHead className="text-xs text-muted-foreground hidden sm:table-cell">Extracted</TableHead>
                  <TableHead className="text-xs text-muted-foreground hidden sm:table-cell">Loaded</TableHead>
                  <TableHead className="text-xs text-muted-foreground hidden md:table-cell">Duration</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Started</TableHead>
                  <TableHead className="text-xs text-muted-foreground hidden lg:table-cell">Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(run => (
                  <TableRow key={run.id} className="border-border/50">
                    <TableCell className="font-medium text-sm font-mono">{run.pipeline_name}</TableCell>
                    <TableCell><StatusBadge status={run.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono hidden sm:table-cell">
                      {(run.records_extracted || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono hidden sm:table-cell">
                      {(run.records_loaded || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                      {run.duration_seconds ? `${run.duration_seconds}s` : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {run.started_at ? format(new Date(run.started_at), 'MMM d, HH:mm') : '—'}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-destructive max-w-[200px] truncate hidden lg:table-cell">
                      {run.error_message || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}