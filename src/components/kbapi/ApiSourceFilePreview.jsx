import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Loader2, AlertCircle, Eye, ArrowUp, ArrowDown, ArrowUpDown, RefreshCw } from 'lucide-react';

export default function ApiSourceFilePreview({ item }) {
  const [expanded, setExpanded] = useState(false);
  const [sortCol, setSortCol] = useState('iri');
  const [sortDir, setSortDir] = useState('asc');

  const toggleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3" />
      : <ArrowDown className="w-3 h-3" />;
  };

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['previewApiSourceFile', item.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('fetchApiSourceContent', {
        section: item.section,
      });
      return res.data;
    },
    enabled: expanded,
    // Always fetch fresh — never serve stale cached data when re-expanding
    staleTime: 0,
    gcTime: 0,
  });

  return (
    <div className="border-t border-border/30">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1.5 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
      >
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5" />
          : <ChevronRight className="w-3.5 h-3.5" />}
        <Eye className="w-3.5 h-3.5" />
        Preview
        {data && (
          <span className="ml-1 text-muted-foreground/70">({data.member_count} members)</span>
        )}
        {expanded && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); refetch(); }}
            className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Refresh from GitHub"
          >
            <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3">
          {isLoading && (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Fetching and parsing source file…
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 py-3 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error.response?.data?.error || error.message || 'Failed to load preview'}</span>
            </div>
          )}
          {data && data.members && (
            <div className="rounded-lg border border-border/40 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/30">
                    {[
                      { key: 'iri', label: 'IRI', cls: 'w-1/4' },
                      { key: 'label', label: 'Label', cls: 'w-1/4' },
                      { key: 'definition', label: 'Definition', cls: '' },
                    ].map(col => (
                      <th key={col.key} className={`text-left px-3 py-2 font-medium text-muted-foreground ${col.cls}`}>
                        <button
                          onClick={() => toggleSort(col.key)}
                          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          {col.label}
                          <SortIcon col={col.key} />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.members.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">
                        No members found matching "{item.member_identifier || 'skos:Concept'}".
                      </td>
                    </tr>
                  ) : (
                    [...data.members]
                      .sort((a, b) => {
                        const av = (a[sortCol] || '').toLowerCase();
                        const bv = (b[sortCol] || '').toLowerCase();
                        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
                        return sortDir === 'asc' ? cmp : -cmp;
                      })
                      .map((m, i) => (
                      <tr key={i} className={`border-b border-border/30 last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                        <td className="px-3 py-2 font-mono text-primary break-all">{m.iri}</td>
                        <td className="px-3 py-2">{m.label || <span className="text-muted-foreground/50">—</span>}</td>
                        <td className="px-3 py-2 text-muted-foreground">{m.definition || <span className="text-muted-foreground/50">—</span>}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}