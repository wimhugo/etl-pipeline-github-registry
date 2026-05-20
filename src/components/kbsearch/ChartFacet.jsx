import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Palette cycling through chart CSS variables
const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="rounded-md border border-border/60 bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <span className="font-medium text-foreground">{name}</span>
      <span className="ml-2 text-muted-foreground">{value}</span>
    </div>
  );
};

export default function ChartFacet({ facetKey, facet, counts = {}, facetState, onChange }) {
  const selected = facetState?.values || [];
  const logic = facetState?.logic || facet.default_logic || 'OR';

  const data = Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const toggle = (name) => {
    const next = selected.includes(name)
      ? selected.filter(v => v !== name)
      : [...selected, name];
    onChange(facetKey, { values: next, logic });
  };

  if (data.length === 0) {
    return (
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-foreground">{facet.title}</span>
        <div className="text-xs text-muted-foreground italic">No data</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-foreground">{facet.title}</span>

      {/* Pie chart — clicking a slice toggles the filter */}
      <ResponsiveContainer width="100%" height={150}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={28}
            outerRadius={58}
            paddingAngle={2}
            dataKey="value"
            onClick={(entry) => toggle(entry.name)}
            cursor="pointer"
          >
            {data.map((entry, idx) => (
              <Cell
                key={entry.name}
                fill={COLORS[idx % COLORS.length]}
                opacity={selected.length === 0 || selected.includes(entry.name) ? 1 : 0.3}
                stroke={selected.includes(entry.name) ? 'hsl(var(--foreground))' : 'transparent'}
                strokeWidth={selected.includes(entry.name) ? 1.5 : 0}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend rows — also clickable */}
      <div className="space-y-1">
        {data.map((entry, idx) => {
          const active = selected.includes(entry.name);
          return (
            <div
              key={entry.name}
              onClick={() => toggle(entry.name)}
              className={`flex items-center gap-2 cursor-pointer rounded px-1.5 py-0.5 text-[11px] transition-colors ${
                active ? 'bg-muted/60 text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ background: COLORS[idx % COLORS.length] }}
              />
              <span className="flex-1 truncate">{entry.name}</span>
              <span className="tabular-nums">{entry.value}</span>
            </div>
          );
        })}
      </div>

      {selected.length > 0 && (
        <button
          onClick={() => onChange(facetKey, { values: [], logic })}
          className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Clear
        </button>
      )}
    </div>
  );
}