import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Loader2, AlertCircle, Eye } from 'lucide-react';

export default function ApiSourceFilePreview({ item }) {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['previewApiSourceFile', item.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('previewApiSourceFile', {
        file_path: item.file_path,
        member_identifier: item.member_identifier || 'skos:Concept',
      });
      return res.data;
    },
    enabled: expanded,
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
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground w-1/4">IRI</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground w-1/4">Label</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Definition</th>
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
                    data.members.map((m, i) => (
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