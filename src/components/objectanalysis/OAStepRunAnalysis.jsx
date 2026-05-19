import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Microscope, Loader2, CheckCircle2, AlertCircle,
  FileJson, Shield, Zap, Info, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';

export default function OAStepRunAnalysis({
  data,
  onChange,
  openrelActions,
  openrelConstraints,
}) {
  const {
    inputType = 'url',
    objectUrl = '',
    textContent = '',
    analysisResult = null,
    actionMappings = {},
  } = data;

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  const handleAnalyse = async () => {
    setError(null);
    if (inputType === 'url') {
      if (!objectUrl) { setError('Please enter an Object URL in Step 1'); return; }
      try { new URL(objectUrl); } catch { setError('Invalid URL format'); return; }
    } else if (inputType === 'text') {
      if (!textContent.trim()) { setError('Please enter content to analyse in Step 1'); return; }
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
      onChange({ ...data, analysisResult: response.data.analysis, actionMappings: {} });
    } catch (err) {
      setError(err.message || 'Failed to analyse object');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const setMapping = (key, value) =>
    onChange({ ...data, actionMappings: { ...actionMappings, [key]: value } });

  const actionPatterns = analysisResult?.detectedPatterns?.filter(
    p => p.includes('Configured Action:') || p.includes('Potential Action:')
  ) || [];
  const constraintPatterns = analysisResult?.detectedPatterns?.filter(
    p => p.includes('Configured Constraint:') || p.includes('Potential Constraint:')
  ) || [];

  return (
    <div className="rounded-xl border border-border/50 bg-card p-6 space-y-5">
      <div>
        <h2 className="text-sm font-semibold mb-0.5">Run Analysis</h2>
        <p className="text-xs text-muted-foreground">
          Detect actions and constraints in the content and match against ODRL / OpenREL terms.
        </p>
      </div>

      {/* Run button */}
      <div>
        <Button
          onClick={handleAnalyse}
          disabled={isAnalyzing || inputType === 'file'}
          variant="outline"
          className="gap-2"
        >
          {isAnalyzing
            ? <><Loader2 className="w-4 h-4 animate-spin" />Analysing...</>
            : <><Microscope className="w-4 h-4" />Run Analysis</>}
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
        <div className="space-y-4 border-t border-border/50 pt-4">
          {/* Summary */}
          <div className={cn(
            "rounded-md px-3 py-2 text-xs flex items-center gap-2",
            analysisResult.hasRules ? "bg-accent/10 text-accent" : "bg-muted/20 text-muted-foreground"
          )}>
            {analysisResult.hasRules
              ? <CheckCircle2 className="w-4 h-4 shrink-0" />
              : <AlertCircle className="w-4 h-4 shrink-0" />}
            {analysisResult.summary}
          </div>

          {/* Rules */}
          <PatternSection
            icon={<Shield className="w-3.5 h-3.5 text-primary" />}
            label="OpenREL/ODRL Rules"
            hasItems={analysisResult.hasRules}
            patterns={analysisResult.detectedPatterns?.filter(
              p => p.includes('ODRL term:') || p.includes('OpenREL term:') || p.includes('JSON-LD')
            ) || []}
          />

          {/* Actions */}
          <MappingSection
            icon={<Zap className="w-3.5 h-3.5 text-primary" />}
            label="Actions"
            hasItems={analysisResult.hasActions}
            patterns={actionPatterns}
            prefix={['Configured Action: ', 'Potential Action: ']}
            mappingKey="action"
            mappings={actionMappings}
            onMap={setMapping}
            options={openrelActions}
            optionPlaceholder={openrelActions.length > 0 ? 'Map to Action' : 'None configured'}
          />

          {/* Constraints */}
          <MappingSection
            icon={<FileJson className="w-3.5 h-3.5 text-primary" />}
            label="Constraints"
            hasItems={analysisResult.hasConstraints}
            patterns={constraintPatterns}
            prefix={['Configured Constraint: ', 'Potential Constraint: ']}
            mappingKey="constraint"
            mappings={actionMappings}
            onMap={setMapping}
            options={openrelConstraints}
            optionPlaceholder={openrelConstraints.length > 0 ? 'Map to Constraint' : 'None configured'}
          />
        </div>
      )}

      {!analysisResult && !error && (
        <div className="rounded-md px-3 py-4 text-xs bg-muted/20 text-muted-foreground italic text-center">
          No analysis run yet. Click "Run Analysis" above.
        </div>
      )}
    </div>
  );
}

function PatternSection({ icon, label, hasItems, patterns }) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-2 py-1 hover:opacity-80 transition-opacity">
          {icon}
          <span className="text-xs font-medium">{label}</span>
          <Badge variant={hasItems ? 'default' : 'secondary'} className="text-xs ml-auto">
            {hasItems ? 'Detected' : 'Not Found'}
          </Badge>
          <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 mt-1">
        {patterns.map((pattern, idx) => (
          <div key={idx} className="text-xs flex items-center gap-2 p-1.5 rounded bg-muted/20 ml-5">
            <CheckCircle2 className="w-3 h-3 text-accent shrink-0" />
            <span className="font-mono">{pattern}</span>
          </div>
        ))}
        {patterns.length === 0 && (
          <p className="text-xs text-muted-foreground ml-5 italic">No items detected.</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function MappingSection({ icon, label, hasItems, patterns, prefix, mappingKey, mappings, onMap, options, optionPlaceholder }) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-2 py-1 hover:opacity-80 transition-opacity">
          {icon}
          <span className="text-xs font-medium">{label}</span>
          <Badge variant={hasItems ? 'default' : 'secondary'} className="text-xs ml-auto">
            {hasItems ? 'Detected' : 'Not Found'}
          </Badge>
          <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 mt-1">
      {patterns.length === 0 && (
        <p className="text-xs text-muted-foreground ml-5 italic">No items detected.</p>
      )}
      {patterns.map((pattern, idx) => {
        const parts = pattern.split('|');
        const detectedTerm = parts[0].replace(new RegExp(`^(${prefix.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`), '');
        const autoMatchedLabel = parts[2] || '';
        const key = `${mappingKey}-${idx}-${detectedTerm}`;
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
              value={mappings[key] || autoMatchedLabel || ''}
              onValueChange={v => onMap(key, v)}
            >
              <SelectTrigger className="w-[180px] h-7 text-xs">
                <SelectValue placeholder={optionPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {options.length > 0
                  ? options.map((o, i) => <SelectItem key={i} value={o.label}>{o.label}</SelectItem>)
                  : <div className="p-2 text-xs text-muted-foreground">No options configured</div>}
              </SelectContent>
            </Select>
            {autoMatchedLabel && (
              <Badge className="text-xs bg-accent/20 text-accent border-accent/30 shrink-0">Auto</Badge>
            )}
          </div>
        );
      })}
      </CollapsibleContent>
    </Collapsible>
  );
}