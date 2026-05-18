import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertCircle, ChevronDown, ChevronRight, FileJson } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// Simple YAML parser for badge-mapping.yaml structure
function parseBadgeMappingYaml(yamlText) {
  const lines = yamlText.split('\n');
  const result = { sections: [] };
  let currentSection = null;
  let currentItem = null;
  
  for (const line of lines) {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) continue;
    
    const indent = line.search(/\S/);
    const trimmed = line.trim();
    
    // Top-level context blocks (indent 0)
    if (indent === 0 && trimmed.startsWith('context:')) {
      const contextValue = trimmed.replace(/context:\s*["']?([^"']+)["']?/, '$1').trim();
      currentSection = {
        context: contextValue,
        items: []
      };
      result.sections.push(currentSection);
      currentItem = null;
    }
    // Second-level items (indent 2)
    else if (indent === 2 && trimmed.startsWith('-') && currentSection) {
      const itemLine = trimmed.substring(1).trim();
      if (itemLine.startsWith('name:')) {
        currentItem = {
          name: itemLine.replace(/name:\s*["']?([^"']+)["']?/, '$1').trim(),
          profileBadges: []
        };
        currentSection.items.push(currentItem);
      }
    }
    // Third-level profile badges (indent 4)
    else if (indent === 4 && trimmed.startsWith('- profileBadge:') && currentItem) {
      const badgeValue = trimmed.replace(/-?\s*profileBadge:\s*["']?([^"']+)["']?/, '$1').trim();
      currentItem.profileBadges.push(badgeValue);
    }
  }
  
  return result;
}

export default function WorkflowStep3IntendedUse({ workflowId, onComplete }) {
  const [selectedUses, setSelectedUses] = useState([]);
  const [expandedSections, setExpandedSections] = useState({});
  const [yamlContent, setYamlContent] = useState(null);
  const [parsedData, setParsedData] = useState(null);

  // Fetch badge mappings from GlobalConfig
  const { data: globalConfigs = [] } = useQuery({
    queryKey: ['globalConfig'],
    queryFn: () => base44.entities.GlobalConfig.list(),
  });
  const globalConfig = globalConfigs[0];

  // Fetch badge mapping file content from GitHub
  useEffect(() => {
    const fetchYamlContent = async () => {
      if (!globalConfig?.badge_mapping_file || !globalConfig?.kb_search_data_url) {
        return;
      }
      
      try {
        // Try to fetch from GitHub raw URL
        const rawUrl = `${globalConfig.kb_search_data_url}/${globalConfig.badge_mapping_file}`;
        const res = await fetch(rawUrl);
        if (res.ok) {
          const text = await res.text();
          setYamlContent(text);
          const parsed = parseBadgeMappingYaml(text);
          setParsedData(parsed);
        }
      } catch (error) {
        console.error('Failed to fetch badge mapping YAML:', error);
      }
    };

    fetchYamlContent();
  }, [globalConfig?.badge_mapping_file, globalConfig?.kb_search_data_url]);

  // Load saved selections from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`workflow_${workflowId}_intendedUses`);
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
      
      // Save to localStorage
      localStorage.setItem(`workflow_${workflowId}_intendedUses`, JSON.stringify(updated));
      
      // Notify parent of completion if needed
      if (onComplete) {
        onComplete({ intendedUses: updated });
      }
      
      return updated;
    });
  };

  const toggleSection = (sectionKey) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // Filter out "User" context, keep only "Intended Use" and "Ethics Considerations"
  const relevantSections = parsedData?.sections.filter(
    s => s.context !== 'User' && (s.context === 'Intended Use' || s.context === 'Ethics Considerations')
  ) || [];

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Intended Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select the intended use(s) and ethics considerations based on your verified context badges.
          </p>

          {!yamlContent && !parsedData ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border/40">
              <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Loading badge mapping configuration...</p>
                <p className="text-xs mt-1">
                  Please ensure badge-mapping.yaml is configured in KB User Configuration.
                </p>
              </div>
            </div>
          ) : relevantSections.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border/40">
              <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium">No intended use or ethics sections found</p>
                <p className="text-xs mt-1">
                  The badge-mapping.yaml file should contain "Intended Use" and/or "Ethics Considerations" sections.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {relevantSections.map((section, sectionIdx) => {
                const sectionKey = `${section.context}-${sectionIdx}`;
                const isExpanded = expandedSections[sectionKey] !== false; // Default expanded
                const sectionLabel = section.context === 'Intended Use' ? 'Intended Use' : 'Ethics Considerations';
                
                return (
                  <div key={sectionKey} className="rounded-lg border border-border/40 overflow-hidden">
                    {/* Section Header */}
                    <div
                      className="flex items-center justify-between px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleSection(sectionKey)}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                        <Label className="text-sm font-semibold text-foreground">{sectionLabel}</Label>
                        <Badge variant="outline" className="text-xs">
                          {section.items.reduce((sum, item) => sum + item.profileBadges.length, 0)} items
                        </Badge>
                      </div>
                    </div>

                    {/* Section Content */}
                    <Collapsible open={isExpanded}>
                      <CollapsibleContent className="data-[state=open]:animate-none">
                        <div className="p-4 space-y-3 bg-card">
                          {section.items.map((item, itemIdx) => (
                            <div
                              key={`${sectionKey}-item-${itemIdx}`}
                              className="flex items-start gap-3 p-3 rounded-lg border border-border/40 hover:bg-muted/20 transition-colors"
                            >
                              <Checkbox
                                checked={selectedUses.includes(item.name)}
                                onCheckedChange={() => handleToggle(item.name)}
                                className="mt-0.5"
                              />
                              <div className="flex-1">
                                <Label className="text-sm font-medium text-foreground cursor-pointer">
                                  {item.name}
                                </Label>
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
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              })}

              <div className="flex items-center justify-between pt-2">
                <Label className="text-sm font-medium">
                  {selectedUses.length} selected
                </Label>
                {selectedUses.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedUses([]);
                      localStorage.removeItem(`workflow_${workflowId}_intendedUses`);
                      if (onComplete) {
                        onComplete({ intendedUses: [] });
                      }
                    }}
                  >
                    Clear All
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}