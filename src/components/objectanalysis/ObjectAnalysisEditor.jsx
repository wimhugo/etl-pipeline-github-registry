import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Microscope, Link2, Type, File, Loader2, CheckCircle2, AlertCircle,
  FileJson, Shield, Zap, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';

export default function ObjectAnalysisEditor({ open, initialData, onClose, onSave, openrelActions, openrelConstraints, dataLoaded }) {
  const isNew = !initialData?.id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inputType, setInputType] = useState('url');
  const [objectUrl, setObjectUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [actionMappings, setActionMappings] = useState({});

  useEffect(() => {
    if (open) {
      setName(initialData?.name || '');
      setDescription(initialData?.description || '');
      setInputType(initialData?.input_type || 'url');
      setObjectUrl(initialData?.object_url || '');
      setTextContent(initialData?.text_content || '');
      setAnalysisResult(initialData?.analysis_result || null);
      setActionMappings(initialData?.action_mappings || {});
      setError(null);
    }
  }, [open, initialData]);

  const handleAnalyse = async () => {
    setError(null);
    if (inputType === 'url') {
      if (!objectUrl) { setError('Please enter an Object URL'); return; }
      try { new URL(objectUrl); } catch { setError('Invalid URL format'); return; }
    } else if (inputType === 'text') {
      if (!textContent.trim()) { setError('Please enter some text to analyze'); return; }
    } else {
      setError('File upload is not yet implemented'); return;
    }
    setIsAnalyzing(true);
    try {
      const response = await base44.functions.invoke('analyzeObject', {
        inputType,
        objectUrl: inputType === 'url' ? objectUrl : undefined,
        textContent: inputType === 'text' ? textContent : undefined,
      });
      setAnalysisResult(response.data.analysis);
    } catch (err) {
      setError(err.message || 'Failed to analyze object');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = () => {
    if (!name.trim()) { setError('Please enter a name for this analysis'); return; }
    onSave({
      name: name.trim(),
      description: description.trim(),
      input_type: inputType,
      object_url: inputType === 'url' ? objectUrl : '',
      text_content: inputType === 'text' ? textContent : '',
      analysis_result: analysisResult,
      action_mappings: actionMappings,
      last_analysed_at: analysisResult ? (initialData?.last_analysed_at || new Date().toISOString()) : initialData?.last_analysed_at,
    });
  };

  // Update last_analysed_at when analysis completes
  useEffect(() => {
    if (analysisResult) {
      // will be set on save
    }
  }, [analysisResult]);

  const actionPatterns = analysisResult?.detectedPatterns?.filter(p => p.includes('Configured Action:') || p.includes('Potential Action:')) || [];
  const constraintPatterns = analysisResult?.detectedPatterns?.filter(p => p.includes('Configured Constraint:') || p.includes('Potential Constraint:')) || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'New Object Analysis' : 'Edit Object Analysis'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name & Description */}
          <div className="space-y-2">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Analysis name *"
            />
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Description (optional)"
            />
          </div>

          {/* Input Method */}
          <Tabs value={inputType} onValueChange={setInputType}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="url" className="gap-2"><Link2 className="w-4 h-4" />URL</TabsTrigger>
              <TabsTrigger value="text" className="gap-2"><Type className="w-4 h-4" />Text</TabsTrigger>
              <TabsTrigger value="file" className="gap-2"><File className="w-4 h-4" />File</TabsTrigger>
            </TabsList>
            <TabsContent value="url" className="mt-3">
              <Input
                value={objectUrl}
                onChange={e => setObjectUrl(e.target.value)}
                placeholder="https://example.com/object.json"
              />
            </TabsContent>
            <TabsContent value="text" className="mt-3">
              <Textarea
                value={textContent}
                onChange={e => setTextContent(e.target.value)}
                placeholder="Paste or type content to analyze..."
                className="min-h-[150px]"
              />
            </TabsContent>
            <TabsContent value="file" className="mt-3">
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border/50 rounded-lg bg-muted/20">
                <File className="w-7 h-7 text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground text-center">File upload <span className="text-accent">coming soon</span></p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end">
            <Button onClick={handleAnalyse} disabled={isAnalyzing || inputType === 'file'} variant="outline" className="gap-2">
              {isAnalyzing ? <><Loader2 className="w-4 h-4 animate-spin" />Analyzing...</> : <><Microscope className="w-4 h-4" />Run Analysis</>}
            </Button>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Results */}
          {analysisResult && (
            <div className="space-y-3 border-t border-border/50 pt-4">
              {/* Summary */}
              <div className={cn("rounded-md px-3 py-2 text-xs flex items-center gap-2",
                analysisResult.hasRules ? "bg-accent/10 text-accent" : "bg-muted/20 text-muted-foreground")}>
                {analysisResult.hasRules ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {analysisResult.summary}
              </div>

              {/* Rules */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium">OpenREL/ODRL Rules</span>
                  <Badge variant={analysisResult.hasRules ? "default" : "secondary"} className="text-xs ml-auto">
                    {analysisResult.hasRules ? 'Detected' : 'Not Found'}
                  </Badge>
                </div>
                {analysisResult.hasRules && analysisResult.detectedPatterns
                  .filter(p => p.includes('ODRL term:') || p.includes('OpenREL term:') || p.includes('JSON-LD'))
                  .map((pattern, idx) => (
                    <div key={idx} className="text-xs flex items-center gap-2 p-1.5 rounded bg-muted/20 ml-5">
                      <CheckCircle2 className="w-3 h-3 text-accent shrink-0" />
                      <span className="font-mono">{pattern}</span>
                    </div>
                  ))}
              </div>

              {/* Actions */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium">Actions</span>
                  <Badge variant={analysisResult.hasActions ? "default" : "secondary"} className="text-xs ml-auto">
                    {analysisResult.hasActions ? 'Detected' : 'Not Found'}
                  </Badge>
                </div>
                {actionPatterns.map((pattern, idx) => {
                  const parts = pattern.split('|');
                  const detectedTerm = parts[0].replace(/^(Configured Action: |Potential Action: )/, '');
                  const autoMatchedLabel = parts[2] || '';
                  const mappingKey = `action-${idx}-${detectedTerm}`;
                  return (
                    <div key={idx} className="text-xs flex items-center gap-2 p-1.5 rounded bg-muted/20 ml-5">
                      <CheckCircle2 className="w-3 h-3 text-accent shrink-0" />
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <span className="font-mono truncate">{detectedTerm}</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3 h-3 text-muted-foreground cursor-help shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent><p className="text-xs">Detected phrase: "{detectedTerm}"</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Select
                        value={actionMappings[mappingKey] || autoMatchedLabel || ""}
                        onValueChange={v => setActionMappings(prev => ({ ...prev, [mappingKey]: v }))}
                      >
                        <SelectTrigger className="w-[180px] h-7 text-xs">
                          <SelectValue placeholder={openrelActions.length > 0 ? "Map to Action" : "None configured"} />
                        </SelectTrigger>
                        <SelectContent>
                          {openrelActions.length > 0
                            ? openrelActions.map((a, i) => <SelectItem key={i} value={a.label}>{a.label}</SelectItem>)
                            : <div className="p-2 text-xs text-muted-foreground">No actions configured</div>}
                        </SelectContent>
                      </Select>
                      {autoMatchedLabel && <Badge className="text-xs bg-accent/20 text-accent border-accent/30 shrink-0">Auto</Badge>}
                    </div>
                  );
                })}
              </div>

              {/* Constraints */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileJson className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium">Constraints</span>
                  <Badge variant={analysisResult.hasConstraints ? "default" : "secondary"} className="text-xs ml-auto">
                    {analysisResult.hasConstraints ? 'Detected' : 'Not Found'}
                  </Badge>
                </div>
                {constraintPatterns.map((pattern, idx) => {
                  const parts = pattern.split('|');
                  const detectedTerm = parts[0].replace(/^(Configured Constraint: |Potential Constraint: )/, '');
                  const autoMatchedLabel = parts[2] || '';
                  const mappingKey = `constraint-${idx}-${detectedTerm}`;
                  return (
                    <div key={idx} className="text-xs flex items-center gap-2 p-1.5 rounded bg-muted/20 ml-5">
                      <CheckCircle2 className="w-3 h-3 text-accent shrink-0" />
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <span className="font-mono truncate">{detectedTerm}</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3 h-3 text-muted-foreground cursor-help shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent><p className="text-xs">Detected phrase: "{detectedTerm}"</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Select
                        value={actionMappings[mappingKey] || autoMatchedLabel || ""}
                        onValueChange={v => setActionMappings(prev => ({ ...prev, [mappingKey]: v }))}
                      >
                        <SelectTrigger className="w-[180px] h-7 text-xs">
                          <SelectValue placeholder={openrelConstraints.length > 0 ? "Map to Constraint" : "None configured"} />
                        </SelectTrigger>
                        <SelectContent>
                          {openrelConstraints.length > 0
                            ? openrelConstraints.map((c, i) => <SelectItem key={i} value={c.label}>{c.label}</SelectItem>)
                            : <div className="p-2 text-xs text-muted-foreground">No constraints configured</div>}
                        </SelectContent>
                      </Select>
                      {autoMatchedLabel && <Badge className="text-xs bg-accent/20 text-accent border-accent/30 shrink-0">Auto</Badge>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {isNew ? 'Create' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}