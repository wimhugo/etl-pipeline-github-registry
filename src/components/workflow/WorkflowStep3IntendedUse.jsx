import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Loader2, AlertCircle, ChevronDown, ChevronRight, FileJson,
  Target, Scale, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// Collapsible section (matches WorkflowStep1UserContext)
function Section({ icon: Icon, title, badge, defaultOpen = true, headerExtra, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <div className="flex items-center bg-muted/30 hover:bg-muted/50 transition-colors">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex-1 flex items-center gap-2 px-3.5 py-2.5 text-left flex-wrap min-w-0"
        >
          {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          <span className="text-xs font-semibold text-foreground">{title}</span>
          {badge}
        </button>
        {headerExtra}
        <button onClick={() => setOpen(o => !o)} className="px-3 py-2.5 shrink-0">
          {open
            ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          }
        </button>
      </div>
      {open && (
        <div className="px-3.5 py-3 border-t border-border/40">
          {children}
        </div>
      )}
    </div>
  );
}

// Simple YAML parser for badge-mapping.yaml structure
function parseBadgeMappingYaml(yamlText) {
  const lines = yamlText.split('\n');
  const result = { sections: [] };
  let currentSection = null;
  
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    
    const indent = line.search(/\S/);
    const trimmed = line.trim();
    
    if (indent === 0 && trimmed.startsWith('-context:')) {
      const contextValue = trimmed.replace(/-?\s*context:\s*["']?([^"']+)["']?/, '$1').trim();
      currentSection = {
        context: contextValue,
        items: []
      };
      result.sections.push(currentSection);
    }
    else if (indent === 2 && trimmed.startsWith('- profileBadge:') && currentSection) {
      const profileBadge = trimmed.replace(/-?\s*profileBadge:\s*["']?([^"']+)["']?/, '$1').trim();
      const newItem = {
        name: profileBadge,
        profileBadges: [profileBadge]
      };
      currentSection.items.push(newItem);
    }
  }
  
  return result;
}

export default function WorkflowStep3IntendedUse({ instanceId, workflowId, onComplete }) {
  const [selectedUses, setSelectedUses] = useState([]);
  const [userContext, setUserContext] = useState(null);

  // Fetch badge mappings from GlobalConfig
  const { data: globalConfigs = [] } = useQuery({
    queryKey: ['globalConfig'],
    queryFn: () => base44.entities.GlobalConfig.list(),
  });
  const globalConfig = globalConfigs[0];

  // Load user context from localStorage (set in step 1)
  useEffect(() => {
    const savedContext = localStorage.getItem(
      instanceId ? `wf_${instanceId}_user-context` : 'workflow_user_context'
    );
    if (savedContext) {
      try {
        setUserContext(JSON.parse(savedContext));
      } catch (e) {
        console.error('Failed to parse saved user context:', e);
      }
    }
  }, []);

  // Build verified context badges from user context
  const verifiedContextBadges = useMemo(() => {
    if (!userContext) return [];
    
    const badges = [];
    
    if (userContext.verifiedEducation) {
      badges.push({ label: 'Verified HEI Researcher', contextBadge: 'verified_education', colour: 'accent' });
    }
    if (userContext.verifiedResearch) {
      badges.push({ label: 'Verified Researcher', contextBadge: 'verified_research', colour: 'accent' });
    }
    
    if (userContext.institutionType === 'Higher Education Institution') {
      badges.push({ label: 'Higher Education Institution', contextBadge: 'hei_institution', colour: 'primary' });
    } else if (userContext.institutionType === 'Research Organization') {
      badges.push({ label: 'Research Organization', contextBadge: 'research_org', colour: 'primary' });
    }
    
    if (userContext.euMember === true) {
      badges.push({ label: 'EU Member', contextBadge: 'eu_member', colour: 'chart-3' });
    } else if (userContext.euMember === false) {
      badges.push({ label: 'Non-EU', contextBadge: 'non_eu', colour: 'muted' });
    }
    
    if (userContext.researchContext) {
      if (userContext.researchContext.publiclyFunded) {
        badges.push({ label: 'Publicly Funded Research', contextBadge: 'publicly_funded_research', colour: 'chart-4' });
      }
      if (userContext.researchContext.commercial) {
        badges.push({ label: 'Commercial Research', contextBadge: 'commercial_research', colour: 'chart-5' });
      }
      if (userContext.researchContext.commercialApplication) {
        badges.push({ label: 'Commercial Application', contextBadge: 'commercial_application_of_results', colour: 'destructive' });
      }
    }
    
    return badges;
  }, [userContext]);

  // Fetch badge mapping file from GitHub raw URL
  const { data: badgeMappingFile, isLoading: isLoadingBadgeMapping, error: badgeMappingError } = useQuery({
    queryKey: ['badgeMappingFile'],
    queryFn: async () => {
      const url = 'https://raw.githubusercontent.com/wimhugo/openrel/main/.configs/badge_mapping.yaml';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }
      const content = await response.text();
      return { content };
    },
    retry: false,
  });

  // Parse the YAML content from GitHub
  const parsedData = badgeMappingFile?.content
    ? { sections: parseBadgeMappingYaml(badgeMappingFile.content).sections }
    : null;

  // Load saved selections from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(
      instanceId ? `wf_${instanceId}_reuse-context` : `workflow_${workflowId}_intendedUses`
    );
    if (saved) {
      try {
        setSelectedUses(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved intended uses:', e);
      }
    }
  }, [workflowId]);

  const handleToggle = (useKey) => {
    setSelectedUses(prev => {
      const updated = prev.includes(useKey)
        ? prev.filter(k => k !== useKey)
        : [...prev, useKey];
      
      const key = instanceId ? `wf_${instanceId}_reuse-context` : `workflow_${workflowId}_intendedUses`;
      localStorage.setItem(key, JSON.stringify(updated));
      
      if (onComplete) {
        onComplete({ intendedUses: updated });
      }
      
      return updated;
    });
  };

  // Filter sections
  const userSection = parsedData?.sections.find(s => s.context === 'User');
  const relevantSections = parsedData?.sections.filter(
    s => s.context !== 'User' && (s.context === 'Intended Use' || s.context === 'Ethics Considerations')
  ) || [];

  // Build summary badges for selected intended uses
  const selectedBadges = useMemo(() => {
    if (!relevantSections.length || !selectedUses.length) return [];
    
    const badges = [];
    relevantSections.forEach(section => {
      section.items.forEach(item => {
        if (selectedUses.includes(item.name)) {
          badges.push({
            label: item.name,
            type: 'selected',
            colour: 'primary'
          });
        }
      });
    });
    return badges;
  }, [selectedUses, relevantSections]);

  return (
    <div className="space-y-3">
      {/* Intro */}
      <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Select intended uses and ethics considerations based on your intended reuse context. Your selections are saved automatically.
        </p>
      </div>

      {/* Selected Uses Summary */}
      {selectedBadges.length > 0 && (
        <Section icon={FileJson} title="Selected Uses" defaultOpen={true}>
          <div className="flex flex-wrap gap-2">
            {selectedBadges.map((badge, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className={cn(
                  "text-xs px-2.5 py-1 border",
                  badge.colour === 'primary' ? 'bg-primary/15 text-primary border-primary/40' : 'bg-muted/40 text-muted-foreground border-border/50'
                )}
              >
                {badge.label}
              </Badge>
            ))}
          </div>
        </Section>
      )}

      {/* Loading / Error States */}
      {isLoadingBadgeMapping ? (
        <Section icon={Target} title="Intended Use" defaultOpen={false}>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border/40">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium">Loading badge mapping configuration...</p>
            </div>
          </div>
        </Section>
      ) : badgeMappingError ? (
        <Section icon={Target} title="Intended Use" defaultOpen={false}>
          <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm text-destructive">
              <p className="font-medium">Failed to load badge mapping</p>
              <p className="text-xs mt-1">
                {badgeMappingError.message?.includes('Bad credentials') 
                  ? 'GitHub token is invalid or not configured. Please contact your administrator.'
                  : badgeMappingError.message || 'Unable to fetch from GitHub.'}
              </p>
            </div>
          </div>
        </Section>
      ) : !parsedData || relevantSections.length === 0 ? (
        <Section icon={Target} title="Intended Use" defaultOpen={false}>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border/40">
            <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium">No badge mapping found</p>
              <p className="text-xs mt-1">
                The file .configs/badge_mapping.yaml was not found or is empty.
              </p>
            </div>
          </div>
        </Section>
      ) : (
        <>
          {/* Intended Use Section */}
          {relevantSections.map((section, sectionIdx) => {
            const sectionKey = `${section.context}-${sectionIdx}`;
            const sectionLabel = section.context === 'Intended Use' ? 'Intended Use' : 'Ethics Considerations';
            const SectionIcon = section.context === 'Intended Use' ? Target : Scale;
            
            return (
              <Section key={sectionKey} icon={SectionIcon} title={sectionLabel} defaultOpen={sectionIdx === 0}>
                <div className="space-y-3">
                  {section.items.map((item, itemIdx) => (
                    <label
                      key={`${sectionKey}-item-${itemIdx}`}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border/40 hover:bg-muted/20 transition-colors cursor-pointer group"
                    >
                      <Checkbox
                        checked={selectedUses.includes(item.name)}
                        onCheckedChange={() => handleToggle(item.name)}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                          {item.name}
                        </span>
                        {item.profileBadges.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {item.profileBadges.map((badge, badgeIdx) => (
                              <Badge
                                key={badgeIdx}
                                variant="secondary"
                                className="text-[10px] px-2 py-0.5"
                              >
                                {badge}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>

                {/* Selection count */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/40">
                  <Label className="text-xs font-medium">
                    {selectedUses.filter(k => 
                      section.items.some(item => item.name === k)
                    ).length} selected in this section
                  </Label>
                  {selectedUses.some(k => 
                    section.items.some(item => item.name === k)
                  ) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const sectionKeys = section.items.map(item => item.name);
                        const updated = selectedUses.filter(k => !sectionKeys.includes(k));
                        setSelectedUses(updated);
                        const key = instanceId ? `wf_${instanceId}_reuse-context` : `workflow_${workflowId}_intendedUses`;
                        localStorage.setItem(key, JSON.stringify(updated));
                        if (onComplete) {
                          onComplete({ intendedUses: updated });
                        }
                      }}
                      className="h-7 text-xs"
                    >
                      Clear Section
                    </Button>
                  )}
                </div>
              </Section>
            );
          })}

          {/* Clear All */}
          {selectedUses.length > 0 && (
            <div className="flex items-center justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedUses([]);
                  const key = instanceId ? `wf_${instanceId}_reuse-context` : `workflow_${workflowId}_intendedUses`;
                  localStorage.removeItem(key);
                  if (onComplete) {
                    onComplete({ intendedUses: [] });
                  }
                }}
                className="h-8 text-xs"
              >
                Clear All Selections
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}