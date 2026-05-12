import React, { useState } from 'react';
import { Pencil, Copy, Trash2, ChevronDown, ChevronRight, Search, Loader2, Save, BookmarkCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';

/**
 * Matching logic:
 * 1. For each selected scenario ID, find constraints where constraint.scenario === scenario.label (string match)
 * 2. Collect all matched constraint IDs
 * 3. Find policies where ALL collected constraint IDs appear in the policy's rules (permissions/prohibitions/duties)
 */
function runMatch(scenario, scenarioLabelMap, constraintsArray, policies) {
  const selectedIds = scenario.selected_scenario_ids || [];

  // Step 1: collect constraint IDs linked to selected scenarios by label match
  const requiredConstraintIds = new Set();
  for (const sid of selectedIds) {
    const label = scenarioLabelMap[sid] || sid;
    for (const c of constraintsArray) {
      const cScenario = c.scenario || c.Scenario;
      const scenarios = Array.isArray(cScenario) ? cScenario : (cScenario ? [String(cScenario)] : []);
      if (scenarios.some(s => String(s).trim() === label.trim())) {
        if (c.id) requiredConstraintIds.add(c.id);
      }
    }
  }

  if (requiredConstraintIds.size === 0) return { matches: [], requiredConstraintIds: [] };

  // Step 2: find policies that contain ALL required constraint IDs in their rules
  function policyConstraintIds(policy) {
    const ids = new Set();
    for (const ruleType of ['permission', 'permissions', 'prohibition', 'prohibitions', 'obligation', 'obligations', 'duty', 'duties']) {
      for (const rule of policy[ruleType] || []) {
        const constraints = Array.isArray(rule.constraint) ? rule.constraint : (rule.constraint ? [rule.constraint] : []);
        for (const c of constraints) {
          const cid = c['@id'] || c.id || c.uid;
          if (cid) ids.add(cid);
        }
      }
    }
    return ids;
  }

  function normalizeId(id) {
    return String(id).replace(/[.:]/g, '_').toLowerCase();
  }

  const matches = policies.filter(p => {
    const pIds = new Set([...policyConstraintIds(p)].map(normalizeId));
    return [...requiredConstraintIds].every(id => pIds.has(normalizeId(id)));
  });

  return { matches, requiredConstraintIds: [...requiredConstraintIds] };
}

export default function UserScenarioCard({ scenario, scenarioLabelMap = {}, constraintsArray = [], policies = [], dataReady = false, onEdit, onClone, onDelete, onSaved }) {
  const [expanded, setExpanded] = useState(false);
  const [matchResult, setMatchResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const ids = scenario.selected_scenario_ids || [];
  const count = ids.length;
  const savedMatches = scenario.saved_matches || [];
  const savedAt = scenario.saved_matches_at;

  const handleFindMatches = (e) => {
    e.stopPropagation();
    const result = runMatch(scenario, scenarioLabelMap, constraintsArray, policies);
    setMatchResult(result);
    setExpanded(true);
  };

  const handleSaveMatches = async () => {
    setSaving(true);
    await base44.entities.UserScenario.update(scenario.id, {
      saved_matches: matchResult.matches.map(p => ({ id: p.id, label: p.label || p.id })),
      saved_matches_at: new Date().toISOString(),
    });
    setSaving(false);
    if (onSaved) onSaved();
  };

  const handleClearMatches = async () => {
    await base44.entities.UserScenario.update(scenario.id, {
      saved_matches: [],
      saved_matches_at: null,
    });
    if (onSaved) onSaved();
  };

  return (
    <div className="w-full rounded-lg border border-border/60 bg-card overflow-hidden">
      {/* Header row */}
      <div className="flex items-start gap-2 px-4 py-3">
        <button
          className="flex items-start gap-2 flex-1 min-w-0 text-left"
          onClick={() => setExpanded(e => !e)}
        >
          <span className="mt-0.5 shrink-0">
            {expanded
              ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
              : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-foreground">{scenario.label}</span>
              <Badge variant="outline" className="text-[10px] px-2 py-0 shrink-0">
                {count} scenario{count !== 1 ? 's' : ''}
              </Badge>
              {matchResult ? (
                <Badge className="text-[10px] px-2 py-0 shrink-0 bg-accent/20 text-accent border border-accent/40">
                  {matchResult.matches.length} match{matchResult.matches.length !== 1 ? 'es' : ''}
                </Badge>
              ) : savedMatches.length > 0 && (
                <Badge className="text-[10px] px-2 py-0 shrink-0 bg-primary/15 text-primary border border-primary/30 gap-1 flex items-center">
                  <BookmarkCheck className="w-2.5 h-2.5" />
                  {savedMatches.length} saved
                </Badge>
              )}
            </div>
            {scenario.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{scenario.description}</p>
            )}
          </div>
        </button>

        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10"
            onClick={handleFindMatches}
            disabled={!dataReady || count === 0}
            title={!dataReady ? 'Loading KB data…' : 'Find matching policies'}
          >
            {!dataReady ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
            {!dataReady ? 'Loading…' : 'Match'}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClone} title="Clone">
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete} title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border/40 bg-muted/10 px-4 py-3 space-y-3">
          {/* Selected scenarios */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Selected Scenarios</p>
            {ids.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic">No scenarios selected.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {ids.map(id => (
                  <span
                    key={id}
                    className="inline-flex items-center rounded border border-border/50 bg-muted/40 px-2.5 py-1 text-xs text-foreground/80 font-mono w-fit"
                  >
                    {scenarioLabelMap[id] || id}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Match results */}
          {matchResult && (
            <div className="border-t border-border/30 pt-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Matching Policies
                  {matchResult.requiredConstraintIds.length > 0 && (
                    <span className="ml-2 normal-case">({matchResult.requiredConstraintIds.length} constraint{matchResult.requiredConstraintIds.length !== 1 ? 's' : ''} required)</span>
                  )}
                </p>
                {matchResult.matches.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px] gap-1 border-primary/40 text-primary hover:bg-primary/10"
                    onClick={handleSaveMatches}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save matches
                  </Button>
                )}
              </div>
              {matchResult.requiredConstraintIds.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No constraints found for selected scenarios — check your constraints file configuration.</p>
              ) : matchResult.matches.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No policies match all required constraints.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {matchResult.matches.map(p => (
                    <span key={p.id} className="inline-flex items-center rounded border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs text-foreground/90 w-fit">
                      {p.label || p.id}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Saved matches (shown when no fresh match result) */}
          {!matchResult && savedMatches.length > 0 && (
            <div className="border-t border-border/30 pt-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <BookmarkCheck className="w-3 h-3 text-primary" />
                  Saved Matches
                  {savedAt && (
                    <span className="normal-case font-normal text-muted-foreground/60">— {new Date(savedAt).toLocaleDateString()}</span>
                  )}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive"
                  onClick={handleClearMatches}
                >
                  Clear
                </Button>
              </div>
              <div className="flex flex-col gap-1">
                {savedMatches.map(p => (
                  <span key={p.id} className="inline-flex items-center rounded border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-foreground/90 w-fit">
                    {p.label || p.id}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}