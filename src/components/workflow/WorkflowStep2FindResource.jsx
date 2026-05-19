import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Search, AlertCircle, CheckCircle2, ExternalLink, FileText, Lock, Unlock, Clock, Link, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';

export default function WorkflowStep2FindResource({ instanceId }) {
  const storageKey = instanceId ? `wf_${instanceId}_find` : null;

  const loadSaved = () => {
    if (!storageKey) return {};
    try { return JSON.parse(localStorage.getItem(storageKey)) || {}; } catch { return {}; }
  };

  const saved = loadSaved();
  const [pid, setPid] = useState(saved.pid || '');
  const [loading, setLoading] = useState(false);
  const [extractingLicense, setExtractingLicense] = useState(false);
  const [matchingSpdx, setMatchingSpdx] = useState(false);
  const [result, setResult] = useState(saved.result || null);
  const [error, setError] = useState(null);
  const [licenseTextOpen, setLicenseTextOpen] = useState(false);

  const persistState = (updates) => {
    if (!storageKey) return;
    const current = loadSaved();
    localStorage.setItem(storageKey, JSON.stringify({ ...current, ...updates }));
  };

  const handleResolvePid = async (e) => {
    e.preventDefault();
    if (!pid.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await base44.functions.invoke('resolvePid', { pid: pid.trim() });
      
      const resolvedData = {
        pid: pid.trim(),
        redirectURL: response.data.redirectURL,
        metadata: response.data.metadata
      };

      setResult(resolvedData);
      persistState({ pid: pid.trim(), result: resolvedData });
    } catch (err) {
      // Extract error details from the response
      const responseData = err.response?.data;
      const customMessage = responseData?.message || responseData?.error || err.message || 'Failed to resolve PID';
      const targetUrl = responseData?.targetUrl;
      
      setError(customMessage);
      if (targetUrl) {
        setResult({ pid: pid.trim(), redirectURL: targetUrl });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExtractLicense = async () => {
    setExtractingLicense(true);
    setError(null);

    // If no metadata available at all, show the toast about upcoming HTML extraction
    if (!result?.metadata) {
      toast({
        title: 'HTML-based license extraction coming soon',
        description: 'We will attempt to extract rights, access, and license data from the target URL HTML.',
        duration: 5000
      });
      setExtractingLicense(false);
      return;
    }

    try {
      const response = await base44.functions.invoke('extractLicenseInfo', { metadata: result.metadata });
      
      if (response.status !== 200) {
        setError('Failed to extract license information');
        return;
      }

      const licenseInfo = response.data;
      setResult(prev => {
        const updated = { ...prev, licenseInfo };
        persistState({ result: updated });
        return updated;
      });

      // Auto-match SPDX if we have a license name or URI
      if (licenseInfo.license.name || licenseInfo.license.url) {
        await handleMatchSpdx(licenseInfo.license.name, licenseInfo.license.url);
      }
    } catch (err) {
      const errorMessage = err.message || 'Failed to extract license information';
      setError(errorMessage);
      
      // Check if this is the "metadata mode not supported" error
      if (errorMessage.includes('This mode') && errorMessage.includes('is not supported')) {
        toast({
          title: 'HTML-based license extraction coming soon',
          description: 'We will extract rights, access, and license data from the target URL HTML.',
          duration: 5000
        });
      }
    } finally {
      setExtractingLicense(false);
    }
  };

  const handleMatchSpdx = async (licenseName, licenseUri) => {
    setMatchingSpdx(true);
    setError(null);

    try {
      const response = await base44.functions.invoke('matchLicenseSpdx', { licenseName, licenseUri });
      
      if (response.status !== 200) {
        setError('Failed to match SPDX license');
        return;
      }

      setResult(prev => {
        const updated = { ...prev, spdxMatch: response.data };
        persistState({ result: updated });
        return updated;
      });
    } catch (err) {
      setError(err.message || 'Failed to match SPDX license');
    } finally {
      setMatchingSpdx(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" />
            Find Resource by PID
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter a Persistent Identifier (PID) such as a DOI (10.1000/182) to resolve and find the resource.
          </p>

          <form onSubmit={handleResolvePid} className="space-y-3">
            <Input
              placeholder="Enter PID (e.g., 10.1000/182, urn:nbn:se:uu:diva-123456)"
              value={pid}
              onChange={(e) => { setPid(e.target.value); persistState({ pid: e.target.value }); }}
              disabled={loading}
              className="bg-muted/50"
            />
            <Button
              type="submit"
              disabled={!pid.trim() || loading}
              className="w-full gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Resolving...' : 'Resolve PID'}
            </Button>
          </form>

          {error && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
          )}

          {result && !result.error && (
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <p className="font-medium text-sm text-foreground">PID Resolved</p>
                    <div className="space-y-1.5 text-xs">
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">PID:</span> {result.pid}
                      </p>
                      <a
                        href={result.redirectURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-primary hover:underline"
                      >
                        View Resource
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {!result.licenseInfo && result?.redirectURL && (
                <Button
                  onClick={handleExtractLicense}
                  disabled={extractingLicense}
                  variant="outline"
                  className="w-full gap-2"
                >
                  {extractingLicense && <Loader2 className="w-4 h-4 animate-spin" />}
                  <FileText className="w-4 h-4" />
                  {extractingLicense ? 'Extracting...' : 'Extract License & Rights'}
                </Button>
              )}

              {result.licenseInfo && !result.spdxMatch && (
                <Button
                  onClick={() => handleMatchSpdx(result.licenseInfo.license.name, result.licenseInfo.license.url)}
                  disabled={matchingSpdx}
                  variant="outline"
                  className="w-full gap-2"
                >
                  {matchingSpdx && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Link className="w-4 h-4" />
                  {matchingSpdx ? 'Matching...' : 'Match to SPDX License'}
                </Button>
              )}

              {result.licenseInfo && (
                <Card className="bg-card border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      License & Access Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={result.licenseInfo.confidence === 'high' ? 'default' : result.licenseInfo.confidence === 'medium' ? 'secondary' : 'destructive'}>
                        Confidence: {result.licenseInfo.confidence}
                      </Badge>
                    </div>

                    {result.licenseInfo.license.name && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">License</p>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-foreground">{result.licenseInfo.license.name}</span>
                          {result.licenseInfo.license.url && (
                            <a
                              href={result.licenseInfo.license.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {result.licenseInfo.accessConditions && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <Lock className="w-3 h-3" /> Access Conditions
                        </p>
                        <p className="text-sm text-foreground">{result.licenseInfo.accessConditions}</p>
                      </div>
                    )}

                    {result.licenseInfo.usageRights && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <Unlock className="w-3 h-3" /> Usage Rights
                        </p>
                        <p className="text-sm text-foreground">{result.licenseInfo.usageRights}</p>
                      </div>
                    )}

                    {result.licenseInfo.restrictions?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Restrictions</p>
                        <ul className="text-sm text-foreground list-disc list-inside space-y-0.5">
                          {result.licenseInfo.restrictions.map((restriction, idx) => (
                            <li key={idx}>{restriction}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.licenseInfo.embargoInfo?.hasEmbargo && (
                      <div className="space-y-1 p-2 rounded bg-muted/30">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <Clock className="w-3 h-3" /> Embargo
                        </p>
                        {result.licenseInfo.embargoInfo.embargoDate && (
                          <p className="text-sm">Ends: {result.licenseInfo.embargoInfo.embargoDate}</p>
                        )}
                        {result.licenseInfo.embargoInfo.embargoReason && (
                          <p className="text-sm text-muted-foreground">{result.licenseInfo.embargoInfo.embargoReason}</p>
                        )}
                      </div>
                    )}

                    {result.licenseInfo.notes && (
                      <div className="text-xs text-muted-foreground italic">
                        {result.licenseInfo.notes}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {result.spdxMatch && (
                <Card className={`bg-card border-border/50 ${!result.spdxMatch.found ? 'border-destructive/20' : ''}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Link className="w-4 h-4 text-primary" />
                      SPDX License Match
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {result.spdxMatch.found ? (
                      <>
                        <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                            <div className="text-xs text-foreground">
                              <span className="font-medium">Matched via {result.spdxMatch.matchReason}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="default">
                              {result.spdxMatch.license.licenseId}
                            </Badge>
                            {result.spdxMatch.license.isOsiApproved && (
                              <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                                OSI Approved
                              </Badge>
                            )}
                            {result.spdxMatch.license.isDeprecatedLicenseId && (
                              <Badge variant="destructive">
                                Deprecated
                              </Badge>
                            )}
                          </div>

                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">License Name</p>
                            <p className="text-sm text-foreground">{result.spdxMatch.license.name}</p>
                          </div>

                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">SPDX URI</p>
                            <a
                              href={result.spdxMatch.license.spdxUri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                            >
                              {result.spdxMatch.license.spdxUri}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>

                          {result.spdxMatch.license.seeAlso?.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">Additional References</p>
                              <ul className="text-sm space-y-1">
                                {result.spdxMatch.license.seeAlso.map((url, idx) => (
                                  <li key={idx}>
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline inline-flex items-center gap-1"
                                    >
                                      {url}
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {result.spdxMatch.license.licenseText && (
                            <Collapsible open={licenseTextOpen} onOpenChange={setLicenseTextOpen}>
                              <div className="space-y-1">
                                <CollapsibleTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
                                  >
                                    License Text
                                    {licenseTextOpen ? (
                                      <ChevronUp className="w-3 h-3" />
                                    ) : (
                                      <ChevronDown className="w-3 h-3" />
                                    )}
                                  </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="p-3 bg-muted/30 rounded text-xs text-foreground max-h-48 overflow-auto whitespace-pre-wrap">
                                    {result.spdxMatch.license.licenseText}
                                  </div>
                                </CollapsibleContent>
                              </div>
                            </Collapsible>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                        <div className="text-sm text-destructive">
                          <p className="font-medium">{result.spdxMatch.message}</p>
                          <p className="text-xs mt-1">
                            This appears to be a custom or non-standard license that is not in the SPDX license list.
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}