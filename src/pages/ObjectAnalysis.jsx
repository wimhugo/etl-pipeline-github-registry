import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Microscope, Link2, Type, File, Loader2, CheckCircle2, AlertCircle, FileJson, Shield, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';

export default function ObjectAnalysis() {
  const [inputType, setInputType] = useState('url');
  const [objectUrl, setObjectUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [fileUrl, setFileUrl] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);

  // Check for URL parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('url');
    if (urlParam) {
      setObjectUrl(urlParam);
      setInputType('url');
    }
  }, []);

  const handleAnalyse = async () => {
    setError(null);
    setAnalysisResult(null);

    // Validate input based on type
    if (inputType === 'url') {
      if (!objectUrl) {
        setError('Please enter an Object URL');
        return;
      }
      try {
        new URL(objectUrl);
      } catch (err) {
        setError('Invalid URL format. Please enter a valid URL.');
        return;
      }
    } else if (inputType === 'text') {
      if (!textContent.trim()) {
        setError('Please enter some text to analyze');
        return;
      }
    } else if (inputType === 'file') {
      setError('File upload is not yet implemented');
      return;
    }

    setIsAnalyzing(true);

    try {
      const response = await base44.functions.invoke('analyzeObject', { 
        inputType, 
        objectUrl: inputType === 'url' ? objectUrl : undefined,
        textContent: inputType === 'text' ? textContent : undefined,
        fileUrl: inputType === 'file' ? fileUrl : undefined
      });
      setAnalysisResult(response.data.analysis);
    } catch (err) {
      setError(err.message || 'Failed to analyze object');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Object Analysis</h1>
        <p className="text-sm text-muted-foreground mt-1">
          This analysis will determine whether OpenREL/ODRL rules, actions, and/or constraints can be determined in the source material or object served from the URL.
        </p>
      </div>

      {/* Input Method Tabs */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Input Method</CardTitle>
          <CardDescription>
            Choose how to provide the content for analysis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={inputType} onValueChange={setInputType}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="url" className="gap-2">
                <Link2 className="w-4 h-4" />
                URL
              </TabsTrigger>
              <TabsTrigger value="text" className="gap-2">
                <Type className="w-4 h-4" />
                Text
              </TabsTrigger>
              <TabsTrigger value="file" className="gap-2">
                <File className="w-4 h-4" />
                File
              </TabsTrigger>
            </TabsList>
            <TabsContent value="url" className="space-y-4 mt-4">
              <div className="flex gap-3">
                <Input
                  value={objectUrl}
                  onChange={(e) => setObjectUrl(e.target.value)}
                  placeholder="https://example.com/object.json"
                  className="flex-1"
                />
              </div>
            </TabsContent>
            <TabsContent value="text" className="space-y-4 mt-4">
              <Textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Paste or type the content to analyze here..."
                className="min-h-[200px]"
              />
            </TabsContent>
            <TabsContent value="file" className="space-y-4 mt-4">
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border/50 rounded-lg bg-muted/20">
                <File className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium text-foreground">File Upload</p>
                <p className="text-xs text-muted-foreground text-center mt-1">
                  Upload a text file for analysis<br />
                  <span className="text-accent">Coming soon</span>
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end mt-4">
            <Button 
              onClick={handleAnalyse} 
              disabled={isAnalyzing || inputType === 'file'}
              className="gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Microscope className="w-4 h-4" />
                  Analyse Object
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-semibold text-destructive">Analysis Failed</p>
              <p className="text-xs text-destructive/80 mt-1">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Results */}
      {analysisResult && (
        <div className="space-y-4">
          {/* Summary Card */}
          <Card className={cn(
            "border-border/50",
            analysisResult.hasRules ? "bg-accent/10" : "bg-muted/10"
          )}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {analysisResult.hasRules ? (
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                )}
                Analysis Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground">{analysisResult.summary}</p>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Object Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Source:</span>
                <span className="text-foreground font-mono truncate max-w-[300px]">{analysisResult.source}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Input Type:</span>
                <span className="text-foreground font-mono capitalize">{analysisResult.inputType}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Content Length:</span>
                <span className="text-foreground font-mono">{analysisResult.contentLength} bytes</span>
              </div>
            </CardContent>
          </Card>

          {/* Detection Results - Detailed */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Detection Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Rules Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">OpenREL/ODRL Rules</span>
                  </div>
                  <Badge variant={analysisResult.hasRules ? "default" : "secondary"}>
                    {analysisResult.hasRules ? 'Detected' : 'Not Found'}
                  </Badge>
                </div>
                {analysisResult.hasRules && (
                  <div className="ml-6 space-y-1">
                    {analysisResult.detectedPatterns
                      .filter(p => p.includes('ODRL term:') || p.includes('OpenREL term:') || p.includes('JSON-LD'))
                      .map((pattern, idx) => (
                        <div key={idx} className="text-xs text-foreground flex items-center gap-2 p-1.5 rounded bg-muted/20">
                          <CheckCircle2 className="w-3 h-3 text-accent shrink-0" />
                          <span className="font-mono">{pattern}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Actions Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Actions</span>
                  </div>
                  <Badge variant={analysisResult.hasActions ? "default" : "secondary"}>
                    {analysisResult.hasActions ? 'Detected' : 'Not Found'}
                  </Badge>
                </div>
                {analysisResult.hasActions && (
                  <div className="ml-6 space-y-1">
                    {analysisResult.detectedPatterns
                      .filter(p => p.includes('Configured Action:') || p.includes('Action/Permission'))
                      .map((pattern, idx) => (
                        <div key={idx} className="text-xs text-foreground flex items-center gap-2 p-1.5 rounded bg-muted/20">
                          <CheckCircle2 className="w-3 h-3 text-accent shrink-0" />
                          <span className="font-mono">{pattern}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Constraints Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Constraints</span>
                  </div>
                  <Badge variant={analysisResult.hasConstraints ? "default" : "secondary"}>
                    {analysisResult.hasConstraints ? 'Detected' : 'Not Found'}
                  </Badge>
                </div>
                {analysisResult.hasConstraints && (
                  <div className="ml-6 space-y-1">
                    {analysisResult.detectedPatterns
                      .filter(p => p.includes('Configured Constraint:') || p.includes('Constraint patterns'))
                      .map((pattern, idx) => (
                        <div key={idx} className="text-xs text-foreground flex items-center gap-2 p-1.5 rounded bg-muted/20">
                          <CheckCircle2 className="w-3 h-3 text-accent shrink-0" />
                          <span className="font-mono">{pattern}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Detected Patterns */}
          {analysisResult.detectedPatterns && analysisResult.detectedPatterns.length > 0 && (
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Detected Patterns ({analysisResult.detectedPatterns.length})</CardTitle>
                <CardDescription>
                  Specific terms and structures found in the content that match OpenREL/ODRL patterns.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {analysisResult.detectedPatterns.map((pattern, idx) => (
                    <li key={idx} className="text-xs text-foreground flex items-start gap-2 p-2 rounded-md bg-muted/30">
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                      <span className="font-mono">{pattern}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}