import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, Loader2 } from 'lucide-react';

export default function SourceTab({ pipeline, onUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setUploading(false);
    setParsing(true);
    const res = await base44.functions.invoke('parseSourceFile', {
      file_url,
      file_name: file.name,
    });
    setParsing(false);
    const ext = file.name.split('.').pop().toLowerCase();
    onUpdate({
      source_file_url: file_url,
      source_file_name: file.name,
      source_type: ext,
      source_fields: res.data?.fields || [],
      source_record_count: res.data?.record_count ?? null,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-xs">Source Type</Label>
        <Select
          value={pipeline.source_type || 'csv'}
          onValueChange={val => onUpdate({ source_type: val })}
        >
          <SelectTrigger className="mt-1.5 h-8 text-xs w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="csv">CSV</SelectItem>
            <SelectItem value="json">JSON</SelectItem>
            <SelectItem value="txt">TXT</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Input File</Label>
        <div className="mt-2">
          {pipeline.source_file_name ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
              <FileText className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{pipeline.source_file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {pipeline.source_fields?.length || 0} fields detected
                  {pipeline.source_record_count != null && ` · ${pipeline.source_record_count} records`}
                </p>
              </div>
              <label className="cursor-pointer">
                <input type="file" accept=".csv,.txt,.json" onChange={handleFileUpload} className="hidden" />
                <span className="text-xs text-primary hover:text-primary/80">Replace</span>
              </label>
            </div>
          ) : (
            <label className={`flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-border/50 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all ${uploading || parsing ? 'opacity-50 pointer-events-none' : ''}`}>
              <input type="file" accept=".csv,.txt,.json" onChange={handleFileUpload} className="hidden" />
              {uploading ? <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" /> :
               parsing ? <Loader2 className="w-8 h-8 text-primary animate-spin" /> :
               <Upload className="w-8 h-8 text-muted-foreground" />}
              <div className="text-center">
                <p className="text-sm font-medium">{uploading ? 'Uploading…' : parsing ? 'Detecting fields…' : 'Upload source file'}</p>
                <p className="text-xs text-muted-foreground mt-1">CSV, TXT (label: value), or JSON</p>
              </div>
            </label>
          )}
        </div>
      </div>

      {pipeline.source_fields?.length > 0 && (
        <div>
          <Label className="text-xs">Detected Fields</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {pipeline.source_fields.map(f => (
              <span key={f} className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-mono">{f}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}