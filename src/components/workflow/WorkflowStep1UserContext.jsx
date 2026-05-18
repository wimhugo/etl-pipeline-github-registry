import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2, ShieldCheck, Building2, MapPin,
  FlaskConical, User, Info, ChevronDown, ChevronRight, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

const EU_CODES = new Set([
  'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU',
  'IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK',
]);
const EU_NAMES = new Set([
  'austria','belgium','bulgaria','croatia','cyprus','czechia','czech republic',
  'denmark','estonia','finland','france','germany','greece','hungary','ireland',
  'italy','latvia','lithuania','luxembourg','malta','netherlands','the netherlands',
  'poland','portugal','romania','slovakia','slovenia','spain','sweden',
]);

function isEU(value) {
  if (!value) return false;
  const v = value.trim();
  return EU_CODES.has(v.toUpperCase()) || EU_NAMES.has(v.toLowerCase());
}

// Collapsible section
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

// Inline pill badge for signals
function SignalPill({ active, label, activeClass, icon }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border text-[10px] px-2 py-0.5 font-medium",
      active ? activeClass : "bg-muted/30 text-muted-foreground border-border/50 opacity-50"
    )}>
      {icon}
      {label}
    </span>
  );
}

// Read-only field row
function ProfileField({ icon: Icon, label, value, aside }) {
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
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

export default function WorkflowStep1UserContext({ workflowId }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [rorVerification, setRorVerification] = useState(null); // live ROR lookup result

  const loadProfile = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    else setLoading(true);

    // base44.auth.me() returns all custom fields already flattened — most reliable source
    const freshProfile = await base44.auth.me();
    setProfile(freshProfile);
    setOverrides({});
    setRorVerification(null);

    // If primary_institution_status not yet saved, look it up live from ROR
    const savedStatus = freshProfile?.primary_institution_status;
    const institutionName = freshProfile?.default_institution;
    if (!savedStatus && institutionName) {
      const res = await base44.functions.invoke('verifyInstitution', { name: institutionName });
      setRorVerification(res.data || null);
    } else if (savedStatus) {
      // Already saved — reconstruct the same shape from stored fields
      setRorVerification({ status: savedStatus, match: freshProfile?.primary_institution_ror || null });
    }

    setRefreshing(false);
    setLoading(false);
  }, [user?.email]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

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

  // Signals derived from live ROR lookup (rorVerification) — covers both fresh lookup and saved data
  const verifiedStatus = rorVerification?.status;
  const rorMatch = rorVerification?.match;
  const isVerifiedResearcher = verifiedStatus === 'verified_education' || verifiedStatus === 'verified_research';
  const isHEI = verifiedStatus === 'verified_education';
  // EU: check all available country sources
  const rorCountry = rorMatch?.country_code || '';
  const primaryInst = institutions.find(i => i.name === institution);
  const instCountry = primaryInst?.country || '';
  const isEUMember = isEU(location) || isEU(rorCountry) || isEU(instCountry) || (locations || []).some(l => isEU(l.value));

  const RESEARCH_CONTEXT_OPTIONS = [
    'Publicly Funded Research',
    'Commercial Research',
    'Commercial Application of Results',
  ];

  return (
    <div className="space-y-3">
      {/* Intro */}
      <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Pre-filled from your profile. Adjust for this {workflowId === 'licence' ? 'licensing' : 'reuse'} session without changing your saved profile.
        </p>
      </div>

      {/* Verified Context */}
      <Section
        icon={ShieldCheck}
        title="Verified Context"
        defaultOpen={true}
        headerExtra={
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 ml-auto mr-1 shrink-0"
            onClick={e => { e.stopPropagation(); loadProfile(true); }}
            title="Refresh profile"
          >
            <RefreshCw className={cn("w-3 h-3", refreshing && "animate-spin")} />
          </Button>
        }
      >
        <div className="flex flex-wrap gap-2">
          {/* Researcher */}
          <SignalPill
            active={isVerifiedResearcher}
            label={isVerifiedResearcher ? (isHEI ? 'Verified HEI Researcher' : 'Verified Researcher') : 'Researcher: unverified'}
            activeClass="bg-accent/10 text-accent border-accent/30"
            icon={<ShieldCheck className="w-3 h-3" />}
          />
          {/* HEI / Research Org */}
          <SignalPill
            active={isHEI || verifiedStatus === 'verified_research'}
            label={isHEI ? 'Higher Education Institution' : verifiedStatus === 'verified_research' ? 'Research Org' : 'Not HEI/Research Org'}
            activeClass="bg-primary/10 text-primary border-primary/30"
            icon={<Building2 className="w-3 h-3" />}
          />
          {/* EU */}
          <SignalPill
            active={isEUMember}
            label={isEUMember ? `EU Member (${location})` : (location ? `Non-EU (${location})` : 'EU: unknown')}
            activeClass="bg-blue-500/10 text-blue-400 border-blue-400/30"
            icon={<span className="text-[11px] leading-none">🇪🇺</span>}
          />
          {/* Research context pills */}
          {RESEARCH_CONTEXT_OPTIONS.map(opt => (
            <SignalPill
              key={opt}
              active={contexts.includes(opt)}
              label={opt}
              activeClass="bg-chart-3/10 text-chart-3 border-chart-3/30"
              icon={<FlaskConical className="w-3 h-3" />}
            />
          ))}
        </div>
        {!isVerifiedResearcher && !isEUMember && contexts.length === 0 && (
          <p className="mt-2.5 text-[11px] text-muted-foreground">
            Complete and save your profile to populate these signals.
          </p>
        )}

      </Section>

      {/* Identity */}
      <Section icon={User} title="Identity" defaultOpen={false}>
        <div>
          <ProfileField icon={User} label="Name" value={user?.full_name || user?.email} />
          <ProfileField
            icon={User}
            label="ORCID iD"
            value={orcid}
            aside={orcid && (
              <a href={`https://orcid.org/${orcid}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary underline">
                View
              </a>
            )}
          />
        </div>
      </Section>

      {/* Primary Institution */}
      <Section icon={Building2} title="Primary Institution" defaultOpen={false}>
        {institution ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2 flex-wrap">
              <p className="text-xs text-foreground">{institution}</p>
              {isVerifiedResearcher && (
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full border text-[9px] px-1.5 py-0 font-medium",
                  isHEI ? "bg-primary/10 text-primary border-primary/30" : "bg-accent/10 text-accent border-accent/30"
                )}>
                  <ShieldCheck className="w-2.5 h-2.5" />
                  {isHEI ? 'HEI' : 'Research Org'}
                </span>
              )}
            </div>
            {(() => {
              const inst = institutions.find(i => i.name === institution);
              if (!inst) return null;
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
            {institutions.length > 1 && (
              <div className="pt-1 space-y-1">
                <p className="text-[10px] text-muted-foreground">Switch for this session:</p>
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
          <p className="text-xs text-muted-foreground italic">No institution set — complete your profile first.</p>
        )}
      </Section>

      {/* Jurisdiction / Location */}
      <Section icon={MapPin} title="Jurisdiction / Location" defaultOpen={false}>
        <div className="space-y-2">
          {location ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-foreground">{location}</span>
              {isEU(location) && (
                <span title="EU member state — locn:adminUnitL1" className="inline-flex items-center gap-1 rounded-full border text-[9px] px-1.5 py-0 bg-blue-500/10 text-blue-400 border-blue-400/30 font-medium cursor-help">
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
            <div className="flex flex-wrap gap-1.5">
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
                  {loc.value}{isEU(loc.value) ? ' 🇪🇺' : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* Research Context */}
      <Section icon={FlaskConical} title="Research Context" defaultOpen={false}>
        <div className="space-y-2">
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
      </Section>

      {/* Profile incomplete nudge */}
      {(!orcid || !institution || !location) && (
        <div className="rounded-md border border-muted bg-muted/20 px-3 py-2.5 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Some fields are missing. Complete your <span className="text-primary font-medium">User Profile</span> for richer assertions.
          </p>
        </div>
      )}
    </div>
  );
}