import React, { useState } from 'react';
import { Pencil, Copy, Trash2, ChevronDown, ChevronRight, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
      const cScenario = String(c.scenario || c.Scenario || '');
      if (cScenario.trim() === label.trim()) {
        if (c.id) requiredConstraintIds.add(c.id);
      }
    }
  }

  if (requiredConstraintIds.size === 0) return { matches: [], requiredConstraintIds: [] };

  // Step 2: find policies that contain ALL required constraint IDs in their rules
  function policyConstraintIds(policy) {
    const ids = new Set();
    for (const ruleType of ['permission', 'prohibition', 'obligation', 'duty']) {
      for (const rule of policy[ruleType] || []) {
        for (const c of rule.constraint || []) {
          if (c['@id'] || c.id) ids.add(c['@id'] || c.id);
          if (c.uid) ids.add(c.uid);
        }
      }
    }
    return ids;
  }

  const matches = policies.filter(p => {
    const pIds = policyConstraintIds(p);
    return [...requiredConstraintIds].every(id => pIds.has(id));
  });

  return { matches, requiredConstraintIds: [...requiredConstraintIds] };
}

export default function UserScenarioCard({ scenario, scenarioLabelMap = {}, constraintsArray = [], policies = [], dataReady = false, onEdit, onClone, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [matchResult, setMatchResult] = useState(null);

  const ids = scenario.selected_scenario_ids || [];
  const count = ids.length;

  const handleFindMatches = (e) => {
    e.stopPropagation();
    const result = runMatch(scenario, scenarioLabelMap, constraintsArray, policies);
    setMatchResult(result);
    setExpanded(true);
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
              {matchResult && (
                <Badge className="text-[10px] px-2 py-0 shrink-0 bg-accent/20 text-accent border border-accent/40">
                  {matchResult.matches.length} match{matchResult.matches.length !== 1 ? 'es' : ''}
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
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                Matching Policies
                {matchResult.requiredConstraintIds.length > 0 && (
                  <span className="ml-2 normal-case">({matchResult.requiredConstraintIds.length} constraint{matchResult.requiredConstraintIds.length !== 1 ? 's' : ''} required)</span>
                )}
              </p>
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
        </div>
      )}
    </div>
  );
}