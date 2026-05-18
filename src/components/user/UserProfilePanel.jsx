import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  X, Loader2, RefreshCw, Building2, GraduationCap,
  CheckCircle2, MapPin, ChevronDown, ChevronRight,
  FlaskConical, ShieldCheck, User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import InstitutionVerificationBadge from '@/components/user/InstitutionVerificationBadge';

// EU member states — ISO alpha-2 codes and common names (locn:adminUnitL1 context)
const EU_MEMBERS = new Set([
  'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU',
  'IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK',
  // common English names
  'austria','belgium','bulgaria','croatia','cyprus','czechia','czech republic',
  'denmark','estonia','finland','france','germany','greece','hungary','ireland',
  'italy','latvia','lithuania','luxembourg','malta','netherlands','poland',
  'portugal','romania','slovakia','slovenia','spain','sweden',
]);

function isEULocation(value) {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  // Match ISO-2 code or full name
  return EU_MEMBERS.has(v) || EU_MEMBERS.has(v.toUpperCase());
}

// Collapsible section wrapper
function Section({ title, icon: Icon, defaultOpen = false, badge, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
          <span className="text-xs font-semibold text-foreground">{title}</span>
          {badge && badge}
        </div>
        {open
          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        }
      </button>
      {open && (
        <div className="px-3.5 py-3.5 space-y-3 border-t border-border/40">
          {children}
        </div>
      )}
    </div>
  );
}

export default function UserProfilePanel({ onClose }) {
  const { user } = useAuth();
  const panelRef = useRef(null);

  const [orcid, setOrcid] = useState('');
  const [institutions, setInstitutions] = useState([]);
  const [defaultInstitution, setDefaultInstitution] = useState('');
  // Multiple locations: [{ value, source }]; defaultLocation is the selected one
  const [locations, setLocations] = useState([]);
  const [defaultLocation, setDefaultLocation] = useState('');
  const [researchContexts, setResearchContexts] = useState([]);
  const [loadingOrcid, setLoadingOrcid] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [orcidError, setOrcidError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  // Map of institution name -> { status, match, loading }
  const [verifications, setVerifications] = useState({});

  // Load fresh profile data from API when panel opens
  useEffect(() => {
    base44.auth.me().then(freshUser => {
      if (freshUser) {
        setOrcid(freshUser.orcid || '');
        const savedInstitutions = freshUser.orcid_institutions || [];
        setInstitutions(savedInstitutions);
        setDefaultInstitution(freshUser.default_institution || '');
        // Support both old (string) and new (array) location storage
        const stored = freshUser.locations || [];
        const legacy = freshUser.location ? [{ value: freshUser.location, source: 'manual' }] : [];
        setLocations(stored.length ? stored : legacy);
        setDefaultLocation(freshUser.default_location || freshUser.location || '');
        setResearchContexts(freshUser.research_contexts || []);
        // Re-verify saved institutions so badges show on load
        savedInstitutions.forEach(inst => verifyInstitution(inst.name));
      }
    });
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const addLocation = (value, source = 'orcid') => {
    if (!value) return;
    setLocations(prev => {
      const exists = prev.find(l => l.value === value);
      if (exists) return prev;
      const updated = [...prev, { value, source }];
      // Auto-select first if nothing selected yet
      setDefaultLocation(dl => dl || value);
      return updated;
    });
  };

  const verifyInstitution = async (name) => {
    setVerifications(prev => ({ ...prev, [name]: { loading: true } }));
    const res = await base44.functions.invoke('verifyInstitution', { name });
    const match = res.data?.match;
    setVerifications(prev => ({
      ...prev,
      [name]: { loading: false, status: res.data?.status, match }
    }));
    // Use ROR country as fallback if no ORCID location set yet
    if (match?.country) {
      addLocation(match.country, 'ror');
    }
  };

  const handleFetchOrcid = async () => {
    if (!orcid.trim()) return;
    setLoadingOrcid(true);
    setOrcidError('');
    setInstitutions([]);
    setDefaultInstitution('');
    setLocations([]);
    setDefaultLocation('');
    setVerifications({});
    const res = await base44.functions.invoke('fetchOrcidAffiliations', { orcid: orcid.trim() });
    setLoadingOrcid(false);
    if (res.data?.error) {
      setOrcidError(res.data.error);
    } else {
      const fetched = res.data?.institutions || [];
      setInstitutions(fetched);
      const firstEmp = fetched.find(i => i.type === 'employment' && !i.end_year);
      setDefaultInstitution(firstEmp?.name || fetched[0]?.name || '');

      // Collect all ORCID addresses
      const orcidAddresses = res.data?.orcid_addresses || [];
      orcidAddresses.forEach(addr => addLocation(addr, 'orcid'));

      // Verify all institutions (ROR countries added as fallback)
      fetched.forEach(inst => verifyInstitution(inst.name));
    }
  };

  const handleSave = async () => {
    setSavingProfile(true);
    setSaveSuccess(false);
    await base44.auth.updateMe({
      orcid: orcid.trim(),
      orcid_institutions: institutions,
      default_institution: defaultInstitution,
      locations,
      default_location: defaultLocation,
      // keep legacy field in sync
      location: defaultLocation,
      research_contexts: researchContexts,
    });
    setSavingProfile(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const employments = institutions.filter(i => i.type === 'employment');
  const educations = institutions.filter(i => i.type === 'education');

  // Derive "Verified Researcher" status from primary institution
  const primaryVerification = defaultInstitution ? verifications[defaultInstitution] : null;
  const isVerifiedResearcher =
    primaryVerification?.status === 'verified_education' ||
    primaryVerification?.status === 'verified_research';

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" style={{ background: 'rgba(0,0,0,0.35)' }}>
      <div
        ref={panelRef}
        className="w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <div>
            <h2 className="text-sm font-semibold text-foreground">User Profile</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[220px]">
              {user?.full_name || user?.email}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Collapsible sections */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">

          {/* Section 1: Researcher / Academic Status */}
          <Section
            title="Researcher / Academic Status"
            icon={User}
            defaultOpen={true}
            badge={
              isVerifiedResearcher ? (
                <span className="inline-flex items-center gap-1 rounded-full border text-[10px] px-2 py-0.5 bg-accent/10 text-accent border-accent/30 font-medium ml-1">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  Verified Researcher
                </span>
              ) : null
            }
          >
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-muted-foreground">ORCID iD</label>
              <div className="flex gap-2">
                <Input
                  value={orcid}
                  onChange={e => setOrcid(e.target.value)}
                  placeholder="0000-0000-0000-0000"
                  className="h-8 text-sm font-mono flex-1"
                  onKeyDown={e => e.key === 'Enter' && handleFetchOrcid()}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 shrink-0"
                  onClick={handleFetchOrcid}
                  disabled={!orcid.trim() || loadingOrcid}
                >
                  {loadingOrcid
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <RefreshCw className="w-3.5 h-3.5" />
                  }
                </Button>
              </div>
              {orcidError && <p className="text-xs text-destructive">{orcidError}</p>}
            </div>

            {/* Verified researcher explanation when not yet verified */}
            {!isVerifiedResearcher && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                A <span className="font-medium text-foreground">Verified Researcher</span> pill appears when your primary institution is confirmed as a Higher Education Institution or Research Organization via the ROR registry.
              </p>
            )}

            {/* Show verified researcher status detail */}
            {isVerifiedResearcher && primaryVerification && (
              <div className="rounded-md border border-accent/20 bg-accent/5 px-3 py-2 flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-[11px] font-medium text-foreground">
                    {primaryVerification.status === 'verified_education' ? 'Verified Higher Education Institution' : 'Verified Research Organization'}
                  </p>
                  {primaryVerification.match?.name && (
                    <p className="text-[10px] text-muted-foreground">{primaryVerification.match.name}</p>
                  )}
                </div>
              </div>
            )}
          </Section>

          {/* Section 2: Affiliated Institutions */}
          <Section
            title="Affiliated Institutions"
            icon={Building2}
            defaultOpen={institutions.length > 0}
          >
            {institutions.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Fetch your ORCID above to retrieve your affiliated institutions.
              </p>
            ) : (
              <>
                <p className="text-[11px] text-muted-foreground">Select your primary institution.</p>

                {employments.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Building2 className="w-3 h-3" /> Employment
                    </div>
                    {employments.map((inst, i) => (
                      <InstitutionRow
                        key={i}
                        inst={inst}
                        selected={defaultInstitution === inst.name}
                        onSelect={() => setDefaultInstitution(inst.name)}
                        verification={verifications[inst.name]}
                      />
                    ))}
                  </div>
                )}

                {educations.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <GraduationCap className="w-3 h-3" /> Education
                    </div>
                    {educations.map((inst, i) => (
                      <InstitutionRow
                        key={i}
                        inst={inst}
                        selected={defaultInstitution === inst.name}
                        onSelect={() => setDefaultInstitution(inst.name)}
                        verification={verifications[inst.name]}
                      />
                    ))}
                  </div>
                )}

                {/* Primary institution summary */}
                {defaultInstitution && (
                  <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-0.5">Primary Institution</p>
                      <p className="text-xs text-foreground">{defaultInstitution}</p>
                      {verifications[defaultInstitution] && (
                        <div className="mt-1">
                          <InstitutionVerificationBadge
                            status={verifications[defaultInstitution].status}
                            match={verifications[defaultInstitution].match}
                            loading={verifications[defaultInstitution].loading}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </Section>

          {/* Section 4: Research Context */}
          <Section title="Research Context" icon={FlaskConical} defaultOpen={researchContexts.length > 0}>
            <p className="text-[11px] text-muted-foreground">Select all that apply to your research activities.</p>
            <div className="space-y-2">
              {['Publicly Funded Research', 'Commercial Research', 'Commercial Application of Results'].map(option => {
                const checked = researchContexts.includes(option);
                return (
                  <label key={option} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setResearchContexts(prev =>
                        checked ? prev.filter(v => v !== option) : [...prev, option]
                      )}
                      className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                    />
                    <span className="text-xs text-foreground group-hover:text-primary transition-colors">{option}</span>
                  </label>
                );
              })}
            </div>
          </Section>

          {/* Section 3: Geographic Locations */}
          <Section
            title="Geographic Location(s)"
            icon={MapPin}
            defaultOpen={locations.length > 0}
          >
            <p className="text-[11px] text-muted-foreground">
              Locations sourced from ORCID or ROR. Select your default, or add one manually.
            </p>

            {locations.length > 0 && (
              <div className="space-y-1.5">
                {locations.map((loc, i) => (
                  <button
                    key={i}
                    onClick={() => setDefaultLocation(loc.value)}
                    className={cn(
                      "w-full text-left rounded-md border px-3 py-2 flex items-center justify-between gap-2 transition-all",
                      defaultLocation === loc.value
                        ? "border-primary/60 bg-primary/10"
                        : "border-border/50 bg-muted/20 hover:border-border hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-xs font-medium text-foreground">{loc.value}</span>
                      <span className="text-[10px] text-muted-foreground/60 capitalize">{loc.source}</span>
                      {isEULocation(loc.value) && (
                        <span
                          title="EU member state — locn:adminUnitL1 (W3C Loc-n vocabulary)"
                          className="inline-flex items-center gap-1 rounded-full border text-[9px] px-1.5 py-0 bg-blue-500/10 text-blue-400 border-blue-400/30 font-medium cursor-help"
                        >
                          🇪🇺 EU
                        </span>
                      )}
                    </div>
                    {defaultLocation === loc.value && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Manual add */}
            <div className="flex gap-2">
              <Input
                placeholder="Add location (e.g. Netherlands, NL)"
                className="h-8 text-xs flex-1"
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    addLocation(e.target.value.trim(), 'manual');
                    e.target.value = '';
                  }
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2.5 text-xs shrink-0"
                onClick={(e) => {
                  const input = e.currentTarget.previousSibling;
                  if (input?.value?.trim()) {
                    addLocation(input.value.trim(), 'manual');
                    input.value = '';
                  }
                }}
              >
                Add
              </Button>
            </div>
          </Section>

        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-border/60">
          <Button
            className="w-full h-8 text-xs gap-1.5"
            onClick={handleSave}
            disabled={savingProfile}
          >
            {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saveSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
            {saveSuccess ? 'Saved!' : 'Save Profile'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function InstitutionRow({ inst, selected, onSelect, verification }) {
  const years = [inst.start_year, inst.end_year].filter(Boolean).join('–') || null;
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-md border px-3 py-2 transition-all",
        selected
          ? "border-primary/60 bg-primary/10"
          : "border-border/50 bg-muted/20 hover:border-border hover:bg-muted/40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-foreground leading-snug">{inst.name}</span>
        {selected && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />}
      </div>
      {(inst.department || inst.role) && (
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {[inst.role, inst.department].filter(Boolean).join(' · ')}
        </p>
      )}
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        {years && <span className="text-[10px] text-muted-foreground/70">{years}</span>}
        {inst.city && <span className="text-[10px] text-muted-foreground/70">{[inst.city, inst.country].filter(Boolean).join(', ')}</span>}
        {!inst.end_year && inst.start_year && (
          <Badge className="text-[9px] px-1.5 py-0 bg-accent/15 text-accent border-accent/30 font-normal">current</Badge>
        )}
        {verification && (
          <InstitutionVerificationBadge
            status={verification.status}
            match={verification.match}
            loading={verification.loading}
          />
        )}
      </div>
    </button>
  );
}