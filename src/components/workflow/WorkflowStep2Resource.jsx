import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, FileText, Link as LinkIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';

export default function WorkflowStep2Resource({ instanceId }) {
  const storageKey = instanceId ? `wf_${instanceId}_resource` : null;

  const loadSaved = () => {
    if (!storageKey) return {};
    try { return JSON.parse(localStorage.getItem(storageKey)) || {}; } catch { return {}; }
  };

  const saved = loadSaved();
  const [inputType, setInputType] = useState(saved.inputType || 'url');
  const [url, setUrl] = useState(saved.url || '');
  const [text, setText] = useState(saved.text || '');
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(saved.fileUrl || null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(saved.result || null);
  const [error, setError] = useState(null);

  const persistState = (updates) => {
    if (!storageKey) return;
    const current = loadSaved();
    localStorage.setItem(storageKey, JSON.stringify({ ...current, ...updates }));
  };

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setLoading(true);
    setError(null);

    try {
      const response = await base44.integrations.Core.UploadFile({ file: uploadedFile });
      setFile(uploadedFile);
      setFileUrl(response.file_url);
      persistState({ fileUrl: response.file_url, fileName: uploadedFile.name });
      toast({
        title: 'File uploaded',
        description: uploadedFile.name,
      });
    } catch (err) {
      setError('Failed to upload file');
      toast({
        title: 'Upload failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    const resourceData = {
      inputType,
      url: inputType === 'url' ? url : null,
      text: inputType === 'text' ? text : null,
      fileUrl: inputType === 'file' ? fileUrl : null,
      fileName: inputType === 'file' ? file?.name : null,
    };

    setResult(resourceData);
    persistState(resourceData);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resource Source</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Specify the resource you want to license by providing a URL, pasting text, or uploading a file.
          </p>

          {/* Input type selector */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={inputType === 'url' ? 'default' : 'outline'}
              className="gap-2"
              onClick={() => setInputType('url')}
            >
              <LinkIcon className="w-4 h-4" /> URL
            </Button>
            <Button
              variant={inputType === 'text' ? 'default' : 'outline'}
              className="gap-2"
              onClick={() => setInputType('text')}
            >
              <FileText className="w-4 h-4" /> Text
            </Button>
            <Button
              variant={inputType === 'file' ? 'default' : 'outline'}
              className="gap-2"
              onClick={() => setInputType('file')}
            >
              <Upload className="w-4 h-4" /> File
            </Button>
          </div>

          {/* URL input */}
          {inputType === 'url' && (
            <div className="space-y-2">
              <Input
                placeholder="https://example.com/resource"
                value={url}
                onChange={(e) => { setUrl(e.target.value); persistState({ url: e.target.value }); }}
                className="bg-muted/50"
              />
            </div>
          )}

          {/* Text input */}
          {inputType === 'text' && (
            <div className="space-y-2">
              <Textarea
                placeholder="Paste the resource text here..."
                value={text}
                onChange={(e) => { setText(e.target.value); persistState({ text: e.target.value }); }}
                className="min-h-[200px] bg-muted/50"
              />
            </div>
          )}

          {/* File upload */}
          {inputType === 'file' && (
            <div className="space-y-2">
              <Input
                type="file"
                onChange={handleFileUpload}
                disabled={loading}
                className="bg-muted/50"
              />
              {fileUrl && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  <span>{file?.name || 'File uploaded'}</span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={
              loading ||
              (inputType === 'url' && !url.trim()) ||
              (inputType === 'text' && !text.trim()) ||
              (inputType === 'file' && !fileUrl)
            }
            className="w-full gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving...' : 'Save Resource'}
          </Button>

          {result && (
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  Resource Saved
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Type: {result.inputType}</Badge>
                </div>
                {result.url && (
                  <p className="text-muted-foreground break-all">
                    <span className="font-medium text-foreground">URL:</span> {result.url}
                  </p>
                )}
                {result.text && (
                  <div>
                    <p className="font-medium text-foreground mb-1">Text Preview:</p>
                    <p className="text-muted-foreground line-clamp-3">{result.text}</p>
                  </div>
                )}
                {result.fileUrl && (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">File:</span> {result.fileName}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}