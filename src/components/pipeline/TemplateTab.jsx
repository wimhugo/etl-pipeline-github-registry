import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileCode, Loader2, RefreshCw, Wand2 } from 'lucide-react';

export default function TemplateTab({ pipeline, onUpdate }) {
  const [parsing, setParsing] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestPreview, setSuggestPreview] = useState(null);

  const parseFields = async (content) => {
    setParsing(true);
    const res = await base44.functions.invoke('parseTemplate', { template_content: content });
    setParsing(false);
    return res.data?.fields || [];
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const fields = await parseFields(text);
    onUpdate({ template: text, template_file_name: file.name, template_fields: fields });
  };

  const handleEditorChange = async (content) => {
    onUpdate({ template: content });
  };

  const handleParseManual = async () => {
    if (!pipeline.template) return;
    const fields = await parseFields(pipeline.template);
    onUpdate({ template_fields: fields });
  };

  const handleSuggestFromJson = async () => {
    if (!pipeline.source_file_url) return;
    setSuggesting(true);
    setSuggestPreview(null);
    const res = await base44.functions.invoke('analyzeJsonStructure', { file_url: pipeline.source_file_url });
    setSuggesting(false);
    const { columns, field_mapping, preview } = res.data || {};
    if (!columns?.length) return;
    setSuggestPreview({ columns, preview });
    // Auto-fill: set template_fields and field_mapping
    onUpdate({ template_fields: columns, field_mapping });
  };

  const isJsonToCsv = (pipeline.source_type || 'csv') === 'json' && (pipeline.output_type || 'json') === 'csv';

  return (
    <div className="space-y-6">
      {isJsonToCsv && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 flex items-start gap-3">
          <Wand2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-accent mb-1">JSON → CSV Auto-flatten</p>
            <p className="text-xs text-muted-foreground mb-2">
              Analyse the source JSON structure and automatically suggest columns and mappings for CSV output (Option B: all arrays merged with a <code className="bg-muted px-1 rounded">type</code> column).
            </p>
            <Button size="sm" variant="outline" onClick={handleSuggestFromJson} disabled={suggesting || !pipeline.source_file_url} className="h-7 text-xs gap-1.5 border-accent/40 text-accent hover:text-accent">
              {suggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
              Suggest Mapping from JSON
            </Button>
            {!pipeline.source_file_url && <p className="text-[10px] text-muted-foreground mt-1">Upload a source JSON file first.</p>}
            {suggestPreview && (
              <div className="mt-3 overflow-x-auto">
                <p className="text-[10px] text-muted-foreground mb-1">Preview (up to 3 rows):</p>
                <table className="text-[10px] border-collapse w-full">
                  <thead>
                    <tr>
                      {suggestPreview.columns.map(c => (
                        <th key={c} className="border border-border px-2 py-1 text-left font-mono bg-muted/50 whitespace-nowrap">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {suggestPreview.preview.map((row, i) => (
                      <tr key={i}>
                        {suggestPreview.columns.map(c => (
                          <td key={c} className="border border-border px-2 py-1 font-mono whitespace-nowrap max-w-[160px] overflow-hidden text-ellipsis" title={String(row[c] ?? '')}>
                            {String(row[c] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      <div>
        <Label className="text-xs">Output Type</Label>
        <Select
          value={pipeline.output_type || 'json'}
          onValueChange={val => onUpdate({ output_type: val })}
        >
          <SelectTrigger className="mt-1.5 h-8 text-xs w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="json">JSON</SelectItem>
            <SelectItem value="csv">CSV</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs">{(pipeline.output_type || 'json') === 'csv' ? 'CSV Template (use {{fieldName}} for columns)' : 'JSON / JSON-LD Template'}</Label>
          <div className="flex items-center gap-2">
            {pipeline.template && (
              <Button size="sm" variant="ghost" onClick={handleParseManual} disabled={parsing} className="h-7 text-xs gap-1.5">
                {parsing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Detect Fields
              </Button>
            )}
            <label className="cursor-pointer">
              <input type="file" accept=".json,.jsonld" onChange={handleFileUpload} className="hidden" />
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50 hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                <Upload className="w-3 h-3" /> Upload file
              </span>
            </label>
          </div>
        </div>

        {pipeline.template_file_name && (
          <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
            <FileCode className="w-3.5 h-3.5" />
            {pipeline.template_file_name}
          </div>
        )}

        <Textarea
          value={pipeline.template || ''}
          onChange={e => handleEditorChange(e.target.value)}
          placeholder={(pipeline.output_type || 'json') === 'csv'
            ? '{{field1}},{{field2}},{{field3}}'
            : '{\n  "@context": "https://schema.org",\n  "@type": "Dataset",\n  "name": "{{name}}",\n  "description": "{{description}}"\n}'}
          className="font-mono text-xs bg-muted/50 h-72 resize-none"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Use <code className="bg-muted px-1 rounded">{"{{fieldName}}"}</code> placeholders to mark fields for mapping.
        </p>
      </div>

      {pipeline.template_fields?.length > 0 && (
        <div>
          <Label className="text-xs">Detected Template Fields</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {pipeline.template_fields.map(f => (
              <span key={f} className="px-2.5 py-1 rounded-md bg-accent/10 text-accent text-xs font-mono">{f}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}