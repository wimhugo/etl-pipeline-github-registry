import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs font-medium" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
};

export default function RunsChart({ runs }) {
  // Group runs by day for last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const chartData = last7Days.map(day => {
    const dayRuns = runs.filter(r => r.started_at?.startsWith(day));
    return {
      day: new Date(day).toLocaleDateString('en', { weekday: 'short' }),
      Success: dayRuns.filter(r => r.status === 'success').length,
      Failed: dayRuns.filter(r => r.status === 'failed').length,
    };
  });

  return (
    <Card className="bg-card border-border/50 flex flex-col h-80">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Pipeline Runs — Last 7 Days
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <div className="h-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 25%)" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fill: 'hsl(215 20% 55%)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'hsl(215 20% 55%)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(217 33% 20%)' }} />
              <Bar dataKey="Success" fill="hsl(160 84% 39%)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Failed" fill="hsl(0 72% 51%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}