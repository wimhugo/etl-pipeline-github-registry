import React from 'react';
import ReasonerStepCard from './ReasonerStepCard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Network, Library, Sparkles } from 'lucide-react';

function Field({ label, children }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[220px_1fr] sm:items-center">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

const MODELS = [
  { value: 'gemini_3_flash', label: 'gemini_3_flash (default)' },
  { value: 'automatic', label: 'automatic' },
  { value: 'gemini_3_1_pro', label: 'gemini_3_1_pro' },
  { value: 'gpt_5_mini', label: 'gpt_5_mini' },
  { value: 'claude_sonnet_4_6', label: 'claude_sonnet_4_6' },
];

export default function ReasonerSourceSteps({ config, onChange, disabled }) {
  const patch = (p) => onChange(p);
  return (
    <div className="space-y-2.5">
      <ReasonerStepCard
        step="1" icon={FileText} title="Actions source"
        summary={config.actions_path || 'from KB API configuration'}
      >
        <Field label="actions.ttl path (openrel repo)">
          <Input
            value={config.actions_path}
            onChange={(e) => patch({ actions_path: e.target.value })}
            placeholder=".openrel/vocabs/openrel/actions.ttl (empty = from API config)"
            disabled={disabled}
            className="h-8 text-xs"
          />
        </Field>
        <p className="text-[11px] text-muted-foreground/70">
          Deterministic pass 1: odrl:includedIn, skos mapping propagation, defaultDuty and authored contradicts.
        </p>
      </ReasonerStepCard>

      <ReasonerStepCard
        step="2" icon={Network} title="DALICC dependency graph"
        summary={config.dg_enabled ? `${config.dg_repo} · ${config.dg_path}` : 'disabled'}
      >
        <Field label="Enabled">
          <Switch
            checked={config.dg_enabled}
            onCheckedChange={(v) => patch({ dg_enabled: v })}
            disabled={disabled}
          />
        </Field>
        <Field label="Repository (owner/repo)">
          <Input value={config.dg_repo} onChange={(e) => patch({ dg_repo: e.target.value })} disabled={disabled} className="h-8 text-xs" />
        </Field>
        <Field label="Branch">
          <Input value={config.dg_branch} onChange={(e) => patch({ dg_branch: e.target.value })} disabled={disabled} className="h-8 text-xs" />
        </Field>
        <Field label="Dependency graph file">
          <Input value={config.dg_path} onChange={(e) => patch({ dg_path: e.target.value })} disabled={disabled} className="h-8 text-xs" />
        </Field>
        <p className="text-[11px] text-muted-foreground/70">
          Deterministic pass 2: odrl:includedIn / odrl:implies / dalicc:contradicts edges, canonicalized
          via owl:sameAs and resolved through the actions skos mappings.
        </p>
      </ReasonerStepCard>

      <ReasonerStepCard
        step="3" icon={Library} title="DALICC licence corpus"
        summary={config.corpus_enabled ? `${config.corpus_folder} · min support ${config.corpus_min_support}` : 'disabled'}
      >
        <Field label="Enabled">
          <Switch
            checked={config.corpus_enabled}
            onCheckedChange={(v) => patch({ corpus_enabled: v })}
            disabled={disabled}
          />
        </Field>
        <Field label="Licence folder (Knowledge Base repo)">
          <Input value={config.corpus_folder} onChange={(e) => patch({ corpus_folder: e.target.value })} disabled={disabled} className="h-8 text-xs" />
        </Field>
        <Field label="Minimum support (licences)">
          <Input
            type="number" min="1" value={config.corpus_min_support}
            onChange={(e) => patch({ corpus_min_support: e.target.value })}
            disabled={disabled} className="h-8 text-xs sm:max-w-[140px]"
          />
        </Field>
        <p className="text-[11px] text-muted-foreground/70">
          Corpus pass: duty co-occurrence (→ implies) and prohibition∩permission co-existence
          (→ openrel:allows) across the licence files in the Knowledge Base repo, with support
          counts. Fetched in a single server-side pass.
        </p>
      </ReasonerStepCard>

      <ReasonerStepCard
        step="4" icon={Sparkles} title="LLM pass"
        summary={config.llm_enabled ? config.model : 'disabled (deterministic + corpus only)'}
      >
        <Field label="Enabled">
          <Switch
            checked={config.llm_enabled}
            onCheckedChange={(v) => patch({ llm_enabled: v })}
            disabled={disabled}
          />
        </Field>
        <Field label="Model">
          <Select value={config.model} onValueChange={(v) => patch({ model: v })} disabled={disabled}>
            <SelectTrigger className="h-8 text-xs sm:max-w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <p className="text-[11px] text-muted-foreground/70">
          Probabilistic tier: LLM-drafted contradicts / implies / includedIn gaps for human review.
          Non-default models use more integration credits.
        </p>
      </ReasonerStepCard>
    </div>
  );
}