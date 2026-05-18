import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, CheckCircle2, ShieldCheck, Building2, MapPin,
  FlaskConical, User, RefreshCw, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

const EU_MEMBERS = new Set([
  'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU',
  'IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK',
]);

function isEU(code) {
  return EU_MEMBERS.has((code || '').trim().toUpperCase());
}

// Read-only field row
function ProfileField({ icon: Icon, label, value, badge }) {
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-border/30 last:border-0">
      <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
        {value
          ? <p className="text-xs text-foreground break-words">{value}</p>
          : <p className="text-xs text-muted-foreground italic">Not set</p>
        }
      </div>
      {badge && <div className="shrink-0">{badge}</div>}
    </div>
  );
}

export default function WorkflowStep1UserContext({ workflowId }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // Editable overrides for this workflow session
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    base44.auth.me().then(u => {
      setProfile(u);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const orcid = overrides.orcid ?? profile?.orcid ?? '';
  const institution = overrides.institution ?? profile?.default_institution ?? '';
  const location = overrides.location ?? profile?.default_location ?? '';
  const contexts = overrides.research_contexts ?? profile?.research_contexts ?? [];

  const institutions = profile?.orcid_institutions || [];
  const locations = profile?.locations || [];
  const primaryVerification = profile?.default_institution
    ? null  // verification is session-only in UserProfilePanel; we just show what was saved
    : null;

  // Derive verified researcher from saved institution type (we can't re-run ROR here without extra calls)
  const verifiedStatus = profile?.primary_institution_status;
  const isVerifiedResearcher = verifiedStatus === 'verified_education' || verifiedStatus === 'verified_research';

  const RESEARCH_CONTEXT_OPTIONS = [
    'Publicly Funded Research',
    'Commercial Research',
    'Commercial Application of Results',
  ];

  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Your user context is pre-filled from your profile. You can adjust it for this {workflowId === 'licence' ? 'licensing' : 'reuse'} session without changing your saved profile.
        </p>
      </div>

      {/* Identity */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <div className="px-3.5 py-2.5 bg-muted/30 flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Identity</span>
          {isVerifiedResearcher && (
            <span className="inline-flex items-center gap-1 rounded-full border text-[10px] px-2 py-0.5 bg-accent/10 text-accent border-accent/30 font-medium ml-1">
              <ShieldCheck className="w-2.5 h-2.5" />
              Verified Researcher
            </span>
          )}
        </div>
        <div className="px-3.5">
          <ProfileField
            icon={User}
            label="Name"
            value={user?.full_name || user?.email}
          />
          <ProfileField
            icon={User}
            label="ORCID iD"
            value={orcid}
            badge={orcid && (
              <a
                href={`https://orcid.org/${orcid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-primary underline"
              >
                View
              </a>
            )}
          />
        </div>
      </div>

      {/* Primary Institution */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <div className="px-3.5 py-2.5 bg-muted/30 flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Primary Institution</span>
        </div>
        <div className="px-3.5">
          {institution ? (
            <div className="py-2.5 space-y-1.5">
              <p className="text-xs text-foreground">{institution}</p>
              {institutions.find(i => i.name === institution) && (() => {
                const inst = institutions.find(i => i.name === institution);
                const years = [inst.start_year, inst.end_year].filter(Boolean).join('–');
                return (
                  <div className="flex items-center gap-2 flex-wrap">
                    {years && <span className="text-[10px] text-muted-foreground">{years}</span>}
                    {inst.city && <span className="text-[10px] text-muted-foreground">{[inst.city, inst.country].filter(Boolean).join(', ')}</span>}
                    {!inst.end_year && inst.start_year && (
                      <Badge className="text-[9px] px-1.5 py-0 bg-accent/15 text-accent border-accent/30 font-normal">current</Badge>
                    )}
                  </div>
                );
              })()}
              {/* Session override: allow selecting a different institution */}
              {institutions.length > 1 && (
                <div className="pt-1.5 space-y-1">
                  <p className="text-[10px] text-muted-foreground">Use different institution for this session:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {institutions.map((inst, i) => (
                      <button
                        key={i}
                        onClick={() => setOverrides(o => ({ ...o, institution: inst.name }))}
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full border transition-all",
                          institution === inst.name
                            ? "bg-primary/20 border-primary/40 text-primary"
                            : "bg-muted/30 border-border/50 text-muted-foreground hover:border-border"
                        )}
                      >
                        {inst.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic py-2.5">
              No institution set — complete your profile first.
            </p>
          )}
        </div>
      </div>

      {/* Location */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <div className="px-3.5 py-2.5 bg-muted/30 flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Jurisdiction / Location</span>
        </div>
        <div className="px-3.5 py-2.5 space-y-2">
          {location ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-foreground">{location}</span>
              {isEU(location) && (
                <span
                  title="EU member state — locn:adminUnitL1"
                  className="inline-flex items-center gap-1 rounded-full border text-[9px] px-1.5 py-0 bg-blue-500/10 text-blue-400 border-blue-400/30 font-medium cursor-help"
                >
                  🇪🇺 EU
                </span>
              )}
              {(() => {
                const loc = locations.find(l => l.value === location);
                if (!loc) return null;
                const sources = loc.sources || [loc.source];
                return <span className="text-[10px] text-muted-foreground/60 capitalize">{sources.join(' + ')}</span>;
              })()}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No location set.</p>
          )}
          {locations.length > 1 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {locations.map((loc, i) => (
                <button
                  key={i}
                  onClick={() => setOverrides(o => ({ ...o, location: loc.value }))}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full border transition-all",
                    location === loc.value
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-muted/30 border-border/50 text-muted-foreground hover:border-border"
                  )}
                >
                  {loc.value}
                  {isEU(loc.value) && ' 🇪🇺'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Research Context */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <div className="px-3.5 py-2.5 bg-muted/30 flex items-center gap-2">
          <FlaskConical className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Research Context</span>
        </div>
        <div className="px-3.5 py-3 space-y-2">
          {contexts.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No research context set.</p>
          )}
          {RESEARCH_CONTEXT_OPTIONS.map(opt => {
            const checked = contexts.includes(opt);
            return (
              <label key={opt} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => setOverrides(o => ({
                    ...o,
                    research_contexts: checked
                      ? contexts.filter(v => v !== opt)
                      : [...contexts, opt]
                  }))}
                  className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                />
                <span className="text-xs text-foreground group-hover:text-primary transition-colors">{opt}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Profile incomplete nudge */}
      {(!orcid || !institution || !location) && (
        <div className="rounded-md border border-muted bg-muted/20 px-3 py-2.5 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Some fields are missing. Complete your{' '}
            <span className="text-primary font-medium">User Profile</span>
            {' '}for richer assertions.
          </p>
        </div>
      )}
    </div>
  );
}