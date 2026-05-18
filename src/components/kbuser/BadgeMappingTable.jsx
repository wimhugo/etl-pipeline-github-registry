import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, ChevronDown, ChevronRight, FileJson, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { base44 } from '@/api/base44Client';

const COLOUR_OPTIONS = [
  { label: 'Green',   value: 'accent',      swatch: 'bg-accent',              cls: 'bg-accent/15 text-accent border-accent/40' },
  { label: 'Blue',    value: 'primary',     swatch: 'bg-primary',             cls: 'bg-primary/15 text-primary border-primary/40' },
  { label: 'Sky',     value: 'eu-blue',     swatch: 'bg-blue-500',            cls: 'bg-blue-500/15 text-blue-400 border-blue-400/40' },
  { label: 'Purple',  value: 'chart-3',     swatch: 'bg-chart-3',             cls: 'bg-chart-3/15 text-chart-3 border-chart-3/40' },
  { label: 'Yellow',  value: 'chart-4',     swatch: 'bg-chart-4',             cls: 'bg-chart-4/15 text-chart-4 border-chart-4/40' },
  { label: 'Red',     value: 'destructive', swatch: 'bg-destructive',         cls: 'bg-destructive/15 text-destructive border-destructive/40' },
  { label: 'Grey',    value: 'muted',       swatch: 'bg-muted-foreground',    cls: 'bg-muted/40 text-muted-foreground border-border/50' },
  { label: 'Orange',  value: 'chart-5',     swatch: 'bg-chart-5',             cls: 'bg-chart-5/15 text-chart-5 border-chart-5/40' },
  { label: 'Teal',    value: 'teal',        swatch: 'bg-teal-500',            cls: 'bg-teal-500/15 text-teal-400 border-teal-400/40' },
  { label: 'Pink',    value: 'pink',        swatch: 'bg-pink-500',            cls: 'bg-pink-500/15 text-pink-400 border-pink-400/40' },
];

export function getColourClass(value) {
  return COLOUR_OPTIONS.find(o => o.value === value)?.cls || COLOUR_OPTIONS[6].cls;
}

// All badge labels sourced from WorkflowStep1UserContext (SignalPill) and UserProfilePanel
const PROFILE_BADGE_OPTIONS = [
  // Researcher / institution verification (from SignalPill & UserProfilePanel)
  'Verified HEI Researcher',
  'Verified Researcher',
  'Verified HEI',
  'Verified Research Org',
  // Institution type signals
  'Higher Education Institution',
  'Research Org',
  // EU membership
  'EU Member',
  // Research context checkboxes
  'Publicly Funded Research',
  'Commercial Research',
  'Commercial Application of Results',
];

// Context badges from "Verified Context" section in WorkflowStep1UserContext (includes positive/negative states)
const CONTEXT_BADGE_OPTIONS = [
  // Researcher verification status
  'verified_education',
  'verified_research',
  'researcher_unverified',
  // Institution type
  'hei_institution',
  'research_org',
  'not_hei_research_org',
  // EU membership
  'eu_member',
  'non_eu',
  'eu_unknown',
  // Research context (internal keys)
  'publicly_funded_research',
  'commercial_research',
  'commercial_application_of_results',
];

const EMPTY_ROW = { profileBadge: '', contextBadge: '', colour: 'muted', constraintMapping: '' };

// Parse YAML content into sections with rows
const parseYamlToSections = (yamlContent) => {
  const sections = [];
  const lines = yamlContent.split('\n');
  let currentSection = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) continue;
    
    // Match context header: -context: "User" or - context: "User" or context: "User"
    const contextMatch = line.match(/^-?\s*context:\s*["']?([^"'\n]+)["']?/);
    if (contextMatch && line.search(/\S/) === 0) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        name: contextMatch[1].trim(),
        rows: []
      };
      continue;
    }
    
    // Match row item: - profileBadge: "..." (at indent level 2)
    const rowMatch = line.match(/^\s+-\s+profileBadge:\s*["']?([^"'\n]+)["']?/);
    if (rowMatch && currentSection) {
      const row = {
        profileBadge: rowMatch[1].trim(),
        contextBadge: '',
        colour: 'muted',
        constraintMapping: ''
      };
      
      // Look ahead for remaining fields (indented lines that belong to this row)
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];
        // Stop if we hit another context or profileBadge
        if (nextLine.match(/^-?\s*context:/) || nextLine.match(/^\s+-\s+profileBadge:/)) {
          break;
        }
        // Skip empty lines
        if (!nextLine.trim()) continue;
        
        const ctxMatch = nextLine.match(/contextBadge:\s*["']?([^"'\n]+)["']?/);
        const colourMatch = nextLine.match(/colour:\s*(\S+)/);
        const constraintMatch = nextLine.match(/constraintMapping:\s*["']?([^"'\n]+)["']?/);
        
        if (ctxMatch) row.contextBadge = ctxMatch[1].trim();
        if (colourMatch) row.colour = colourMatch[1].trim();
        if (constraintMatch) row.constraintMapping = constraintMatch[1].trim();
      }
      
      currentSection.rows.push(row);
    }
  }
  
  if (currentSection) {
    sections.push(currentSection);
  }
  
  return sections;
};

// Convert sections back to YAML
const sectionsToYaml = (sections) => {
  return sections.map(section => {
    let yaml = `- context: "${section.name}"\n`;
    if (section.rows && section.rows.length > 0) {
      yaml += section.rows.map(row => 
        ` \\- profileBadge: "${row.profileBadge || ''}"\n  contextBadge: "${row.contextBadge || ''}"\n  colour: ${row.colour || 'muted'}\n  constraintMapping: "${row.constraintMapping || ''}"`
      ).join('\n');
    }
    return yaml;
  }).join('\n');
};

export default function BadgeMappingTable({ 
  rows = [], 
  onChange, 
  constraintOptions = [], 
  mappingFile, 
  onMappingFileChange,
  showLoadFromGithub = true 
}) {
  const [editIdx, setEditIdx] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sections, setSections] = useState([]);
  const [loadingFromGithub, setLoadingFromGithub] = useState(false);
  const [loadError, setLoadError] = useState(null);
  
  // Initialize sections from rows prop whenever it changes
  useEffect(() => {
    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.name !== undefined) {
      // It's already sections data
      setSections(rows);
    } else if (Array.isArray(rows)) {
      // It's legacy flat rows data - wrap in User section
      setSections([{ name: 'User', rows }]);
    } else {
      // Empty - default to User section
      setSections([{ name: 'User', rows: [] }]);
    }
  }, [rows]);

  const loadFromGithub = async () => {
    setLoadingFromGithub(true);
    setLoadError(null);
    
    try {
      const url = 'https://raw.githubusercontent.com/wimhugo/openrel/main/.configs/badge_mapping.yaml';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }
      const content = await response.text();
      const parsedSections = parseYamlToSections(content);
      
      if (parsedSections.length > 0) {
        setSections(parsedSections);
        // Notify parent of all sections
        if (onChange) {
          onChange(parsedSections);
        }
      }
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoadingFromGithub(false);
    }
  };

  // Generate YAML preview from current table values
  const generateYamlPreview = () => {
    if (!sections || sections.length === 0) {
      return '# No mappings defined';
    }
    return sectionsToYaml(sections);
  };

  const updateSectionRows = (sectionIdx, newRows) => {
    const updated = sections.map((s, i) => i === sectionIdx ? { ...s, rows: newRows } : s);
    setSections(updated);
    // Notify parent of all sections changes
    if (onChange) {
      console.log('🔄 BadgeMappingTable onChange (updateSectionRows):', updated);
      onChange(updated);
    }
  };

  const addSection = () => {
    const newSection = { name: 'New Section', rows: [] };
    const updated = [...sections, newSection];
    setSections(updated);
    if (onChange) {
      console.log('🔄 BadgeMappingTable onChange (addSection):', updated);
      onChange(updated);
    }
  };

  const updateSectionName = (sectionIdx, newName) => {
    const updated = sections.map((s, i) => i === sectionIdx ? { ...s, name: newName } : s);
    setSections(updated);
    if (onChange) {
      console.log('🔄 BadgeMappingTable onChange (updateSectionName):', updated);
      onChange(updated);
    }
  };

  const removeSection = (sectionIdx) => {
    const updated = sections.filter((_, i) => i !== sectionIdx);
    setSections(updated);
    if (onChange) {
      console.log('🔄 BadgeMappingTable onChange (removeSection):', updated);
      onChange(updated);
    }
  };

  return (
    <div className="space-y-4">
      {/* Load from GitHub button */}
      {showLoadFromGithub && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Badge Mapping Sections</h3>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={loadFromGithub}
            disabled={loadingFromGithub}
          >
            {loadingFromGithub ? (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Load from GitHub
          </Button>
        </div>
      )}

      {loadError && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-xs text-destructive">{loadError}</p>
        </div>
      )}

      {sections.length === 0 && (
        <p className="text-xs text-muted-foreground italic px-3 py-2">No sections yet. Load from GitHub or add a section.</p>
      )}
      
      {sections.map((section, sectionIdx) => (
        <div key={sectionIdx} className="border border-border/40 rounded-lg overflow-hidden">
          {/* Section Header */}
          <div className="bg-muted/30 px-3 py-2 border-b border-border/40 flex items-center justify-between">
            <Input
              value={section.name}
              onChange={(e) => updateSectionName(sectionIdx, e.target.value)}
              className="w-48 h-7 text-xs font-semibold bg-transparent border-none p-0"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1.5"
              onClick={() => removeSection(sectionIdx)}
            >
              <Trash2 className="w-3 h-3" /> Remove Section
            </Button>
          </div>

          {/* Header */}
          <div className="grid grid-cols-[1.5fr_1.5fr_140px_2fr_32px] gap-3 px-3 pb-2 border-b border-border/40">
            {['Profile Badge', 'Context Badge', 'Badge Colour', 'Constraint Mapping', ''].map((h, i) => (
              <span key={i} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</span>
            ))}
          </div>

          {/* Rows */}
          {section.rows.length === 0 && (
            <p className="text-xs text-muted-foreground italic px-3 py-2">No mappings in this section. Add a row below.</p>
          )}
          {section.rows.map((row, idx) => (
        <div
          key={idx}
          className={cn(
            "grid grid-cols-[1.5fr_1.5fr_140px_2fr_32px] gap-3 items-center px-3 py-2 rounded-md transition-colors",
            editIdx === idx ? "bg-muted/30" : "hover:bg-muted/20"
          )}
          onClick={() => setEditIdx(idx)}
        >
          {editIdx === idx ? (
            <>
              <div className="h-8 flex items-center">
                <select
                  value={row.profileBadge}
                  onChange={e => {
                    const updated = section.rows.map((r, i) => i === idx ? { ...r, profileBadge: e.target.value } : r);
                    updateSectionRows(sectionIdx, updated);
                  }}
                  className="w-full h-7 text-xs rounded-md border border-input bg-muted/50 px-2 text-foreground"
                  onClick={e => e.stopPropagation()}
                >
                  <option value="">— Select badge —</option>
                  {PROFILE_BADGE_OPTIONS.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div className="h-8 flex items-center">
                <select
                  value={row.contextBadge}
                  onChange={e => {
                    const updated = section.rows.map((r, i) => i === idx ? { ...r, contextBadge: e.target.value } : r);
                    updateSectionRows(sectionIdx, updated);
                  }}
                  className="w-full h-7 text-xs rounded-md border border-input bg-muted/50 px-2 text-foreground"
                  onClick={e => e.stopPropagation()}
                >
                  <option value="">— Select context —</option>
                  {CONTEXT_BADGE_OPTIONS.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div className="h-8 flex items-center">
                <select
                  value={row.colour}
                  onChange={e => {
                    const updated = section.rows.map((r, i) => i === idx ? { ...r, colour: e.target.value } : r);
                    updateSectionRows(sectionIdx, updated);
                  }}
                  className="w-full h-7 text-xs rounded-md border border-input bg-muted/50 px-2 text-foreground"
                  onClick={e => e.stopPropagation()}
                >
                  {COLOUR_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="h-8 flex items-center">
                <select
                  value={row.constraintMapping}
                  onChange={e => {
                    const updated = section.rows.map((r, i) => i === idx ? { ...r, constraintMapping: e.target.value } : r);
                    updateSectionRows(sectionIdx, updated);
                  }}
                  className="w-full h-7 text-xs rounded-md border border-input bg-muted/50 px-2 text-foreground"
                  onClick={e => e.stopPropagation()}
                >
                  <option value="">— Select constraint —</option>
                  {constraintOptions.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="h-8 flex items-center"><span className="text-xs text-foreground truncate">{row.profileBadge || <span className="text-muted-foreground italic">—</span>}</span></div>
              <div className="h-8 flex items-center"><span className="text-xs text-muted-foreground font-mono truncate">{row.contextBadge || '—'}</span></div>
              <div className="h-8 flex items-center gap-2">
                <span className={cn("w-4 h-4 rounded-full border shrink-0", COLOUR_OPTIONS.find(o => o.value === row.colour)?.swatch || 'bg-muted-foreground')} />
                <span className="text-xs text-foreground">{COLOUR_OPTIONS.find(o => o.value === row.colour)?.label || row.colour}</span>
              </div>
              <div className="h-8 flex items-center"><span className="text-xs text-foreground truncate">{row.constraintMapping || '—'}</span></div>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
            onClick={e => { e.stopPropagation(); {
              const updated = section.rows.filter((_, i) => i !== idx);
              updateSectionRows(sectionIdx, updated);
            }}}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}

          <div className="px-3 py-2 border-t border-border/40">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 text-xs gap-1.5" 
              onClick={() => {
                const updated = [...section.rows, { ...EMPTY_ROW }];
                updateSectionRows(sectionIdx, updated);
              }}
            >
              <Plus className="w-3.5 h-3.5" /> Add Row
            </Button>
          </div>
        </div>
      ))}

      <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 mt-2" onClick={addSection}>
        <Plus className="w-3.5 h-3.5" /> Add Section
      </Button>
    </div>
  );
}