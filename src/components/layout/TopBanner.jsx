import React, { useState } from 'react';
import { useRole, ROLES } from '@/lib/RoleContext';
import { useVersion } from '@/lib/VersionContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { base44 } from '@/api/base44Client';
import { LogIn, LogOut, User, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import UserProfilePanel from '@/components/user/UserProfilePanel';


export default function TopBanner() {
  const { activeRole, selectRole, activeContainer, selectContainer, appContainers } = useRole();
  const { version, selectVersion, versions } = useVersion();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  const handleContainerSwitch = (c) => {
    selectContainer(c);
    if (version === 'v0.4') {
      if (c === 'KB Manager') navigate('/v0.4/dashboard');
      else if (c === 'KB User') navigate('/v0.4/kb-user/dashboard');
      else navigate('/v0.4/kb-api');
    } else {
      navigate(c === 'KB Manager' ? '/' : '/kb-user/dashboard');
    }
  };

  const handleVersionSwitch = (v) => {
    selectVersion(v);
    if (v === 'v0.4') {
      if (activeContainer === 'KB Manager') navigate('/v0.4/dashboard');
      else if (activeContainer === 'KB User') navigate('/v0.4/kb-user/dashboard');
      else navigate('/v0.4/kb-api');
    } else {
      if (activeContainer === 'KB API') {
        selectContainer('KB Manager');
        navigate('/');
      } else {
        navigate(activeContainer === 'KB Manager' ? '/' : '/kb-user/dashboard');
      }
    }
  };

  const handleLogout = () => base44.auth.logout('/');
  const handleLogin = () => base44.auth.redirectToLogin();

  const versionLabel = versions.find(v => v.value === version)?.label || 'OpenREL';

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-12 bg-sidebar border-b border-border/70 flex items-center px-4 gap-4">
      {/* App logo / title with version dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1.5 min-w-[180px] group">
            <span className="text-xs font-mono font-semibold text-primary uppercase tracking-widest">{versionLabel}</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Version</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {versions.map(v => (
            <DropdownMenuItem
              key={v.value}
              onClick={() => handleVersionSwitch(v.value)}
              className="flex items-center justify-between text-xs"
            >
              {v.label}
              {version === v.value && <Check className="w-3 h-3 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* App container switcher */}
      <div className="flex items-center gap-1.5">
        {appContainers.map(c => (
          <button
            key={c}
            onClick={() => handleContainerSwitch(c)}
            className={cn(
              "px-3 py-1 rounded text-xs font-medium transition-all",
              activeContainer === c
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* Role switcher */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground hidden sm:block">Role:</span>
        <Select value={activeRole} onValueChange={selectRole}>
          <SelectTrigger className="h-7 w-36 text-xs bg-muted/50 border-border/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map(r => (
              <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* User / Auth */}
      {user ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:flex"
            title="Open profile"
          >
            <User className="w-3.5 h-3.5" />
            <span className="max-w-[120px] truncate">{user.full_name || user.email}</span>
          </button>
          <Button variant="ghost" size="icon" className="h-7 w-7 sm:hidden" onClick={() => setProfileOpen(true)} title="Open profile">
            <User className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="h-7 px-2 text-xs gap-1">
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={handleLogin} className="h-7 px-2 text-xs gap-1">
          <LogIn className="w-3.5 h-3.5" />
          Login
        </Button>
      )}

      {profileOpen && <UserProfilePanel onClose={() => setProfileOpen(false)} />}
    </div>
  );
}