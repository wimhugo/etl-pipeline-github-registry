import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileCode, Loader2, RefreshCw } from 'lucide-react';

export default function TemplateTab({ pipeline, onUpdate }) {
  const [parsing, setParsing] = useState(false);

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

  return (
    <div className="space-y-6">
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