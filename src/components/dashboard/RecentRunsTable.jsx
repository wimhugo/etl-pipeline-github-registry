import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatusBadge from '../shared/StatusBadge';
import { format } from 'date-fns';
import { Clock } from 'lucide-react';

export default function RecentRunsTable({ runs }) {
  const recent = runs;

  return (
    <Card className="bg-card border-border/50 flex flex-col h-80">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Recent Runs
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 flex-1 min-h-0 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="text-xs text-muted-foreground">Pipeline</TableHead>
              <TableHead className="text-xs text-muted-foreground">Status</TableHead>
              <TableHead className="text-xs text-muted-foreground hidden sm:table-cell">Records</TableHead>
              <TableHead className="text-xs text-muted-foreground hidden md:table-cell">Duration</TableHead>
              <TableHead className="text-xs text-muted-foreground">Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recent.map((run) => (
              <TableRow key={run.id} className="border-border/50">
                <TableCell className="font-medium text-sm font-mono">{run.pipeline_name}</TableCell>
                <TableCell><StatusBadge status={run.status} /></TableCell>
                <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
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
              </TableRow>
            ))}
            {recent.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  No runs yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}