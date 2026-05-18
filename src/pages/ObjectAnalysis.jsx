import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Microscope, Link2, Loader2, CheckCircle2, AlertCircle, FileJson, Shield, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';

export default function ObjectAnalysis() {
  const [objectUrl, setObjectUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);

  // Check for URL parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('url');
    if (urlParam) {
      setObjectUrl(urlParam);
    }
  }, []);

  const handleAnalyse = async () => {
    setError(null);
    setAnalysisResult(null);

    // Validate URL
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

    setIsAnalyzing(true);

    try {
      const response = await base44.functions.invoke('analyzeObject', { objectUrl });
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

      {/* URL Input Card */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Object URL
          </CardTitle>
          <CardDescription>
            Enter the URL of the object to analyze, or it will be pre-populated from the page parameters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              value={objectUrl}
              onChange={(e) => setObjectUrl(e.target.value)}
              placeholder="https://example.com/object.json"
              className="flex-1"
            />
            <Button 
              onClick={handleAnalyse} 
              disabled={isAnalyzing}
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
                <span className="text-muted-foreground">URL:</span>
                <span className="text-foreground font-mono truncate max-w-[300px]">{analysisResult.url}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Content Type:</span>
                <span className="text-foreground font-mono">{analysisResult.contentType || 'Unknown'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Content Length:</span>
                <span className="text-foreground font-mono">{analysisResult.contentLength} bytes</span>
              </div>
            </CardContent>
          </Card>

          {/* Detection Results */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Detection Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">OpenREL/ODRL Rules</span>
                </div>
                <Badge variant={analysisResult.hasRules ? "default" : "secondary"}>
                  {analysisResult.hasRules ? 'Detected' : 'Not Found'}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Actions</span>
                </div>
                <Badge variant={analysisResult.hasActions ? "default" : "secondary"}>
                  {analysisResult.hasActions ? 'Detected' : 'Not Found'}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Constraints</span>
                </div>
                <Badge variant={analysisResult.hasConstraints ? "default" : "secondary"}>
                  {analysisResult.hasConstraints ? 'Detected' : 'Not Found'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Detected Patterns */}
          {analysisResult.detectedPatterns && analysisResult.detectedPatterns.length > 0 && (
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Detected Patterns</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {analysisResult.detectedPatterns.map((pattern, idx) => (
                    <li key={idx} className="text-xs text-foreground flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-accent shrink-0" />
                      {pattern}
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