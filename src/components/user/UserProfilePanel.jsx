import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Loader2, RefreshCw, Building2, GraduationCap, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function UserProfilePanel({ onClose }) {
  const { user } = useAuth();
  const panelRef = useRef(null);

  const [orcid, setOrcid] = useState('');
  const [institutions, setInstitutions] = useState([]);
  const [defaultInstitution, setDefaultInstitution] = useState('');
  const [loadingOrcid, setLoadingOrcid] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [orcidError, setOrcidError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load existing profile data
  useEffect(() => {
    if (user) {
      setOrcid(user.orcid || '');
      setInstitutions(user.orcid_institutions || []);
      setDefaultInstitution(user.default_institution || '');
    }
  }, [user]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleFetchOrcid = async () => {
    if (!orcid.trim()) return;
    setLoadingOrcid(true);
    setOrcidError('');
    setInstitutions([]);
    setDefaultInstitution('');
    const res = await base44.functions.invoke('fetchOrcidAffiliations', { orcid: orcid.trim() });
    setLoadingOrcid(false);
    if (res.data?.error) {
      setOrcidError(res.data.error);
    } else {
      const fetched = res.data?.institutions || [];
      setInstitutions(fetched);
      // Auto-select first employment as default
      const firstEmp = fetched.find(i => i.type === 'employment' && !i.end_year);
      setDefaultInstitution(firstEmp?.name || fetched[0]?.name || '');
    }
  };

  const handleSave = async () => {
    setSavingProfile(true);
    setSaveSuccess(false);
    await base44.auth.updateMe({
      orcid: orcid.trim(),
      orcid_institutions: institutions,
      default_institution: defaultInstitution,
    });
    setSavingProfile(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const employments = institutions.filter(i => i.type === 'employment');
  const educations = institutions.filter(i => i.type === 'education');

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" style={{ background: 'rgba(0,0,0,0.35)' }}>
      <div
        ref={panelRef}
        className="w-full max-w-sm bg-card border-l border-border shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200"
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* ORCID input */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">ORCID iD</label>
            <p className="text-[11px] text-muted-foreground">
              Enter your ORCID to automatically retrieve your institutional affiliations.
            </p>
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
                {loadingOrcid ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </Button>
            </div>
            {orcidError && <p className="text-xs text-destructive">{orcidError}</p>}
          </div>

          {/* Institutions */}
          {institutions.length > 0 && (
            <div className="space-y-3">
              <label className="text-xs font-medium text-foreground">
                Affiliated Institutions
                <span className="ml-1.5 text-muted-foreground font-normal">— select your primary</span>
              </label>

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
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Default institution summary */}
          {defaultInstitution && (
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5 flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-0.5">Primary Institution</p>
                <p className="text-xs text-foreground">{defaultInstitution}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border/60">
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

function InstitutionRow({ inst, selected, onSelect }) {
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
      </div>
    </button>
  );
}