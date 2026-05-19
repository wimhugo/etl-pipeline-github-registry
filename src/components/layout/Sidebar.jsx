import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useRole } from '@/lib/RoleContext';
import { useProject } from '@/lib/ProjectContext';
import { Menu, X, ChevronRight, LayoutDashboard, FolderOpen, Database, GitBranch, CheckSquare, FileText, Layers, RefreshCw, BookOpen, PenTool, Link2, FileEdit, Box, Eye, Settings2, Search, Pencil, Shuffle, BookMarked, Sliders, SlidersHorizontal, Workflow, BookKey, KeyRound } from 'lucide-react';

const ICON_MAP = {
  'Dashboard':            LayoutDashboard,
  'Projects':             FolderOpen,
  'Knowledge Bases':      Database,
  'ETL Pipeline':         GitBranch,
  'Schema Validator':     CheckSquare,
  'Template Manager':     FileText,
  'Schema Extraction':    Layers,
  'Data Sync':            RefreshCw,
  'Vocabulary Manager':   KeyRound,
  'Vocabulary Linker':    Link2,
  'Vocabulary Maker':     BookOpen,
  'Manual Vocab Links':   PenTool,
  'Annotation Notes':     FileEdit,
  'Populate Sub-Objects': Box,
  'Provenance Viewer':    Eye,
  'Settings':             Settings2,
  'Search':               Search,
  'Annotate':             Pencil,
  'Match':                Shuffle,
  'Compose':              BookMarked,
  'Preferences':          Sliders,
  'Configuration':        SlidersHorizontal,
  'My Workflows':         Workflow,
};

export default function Sidebar({ visible = false, onToggle }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isVisible = visible;
  const setIsVisible = onToggle;
  const { activeProject } = useProject();
  const { visibleFeatures, activeContainer } = useRole();

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const NavContent = () => (
    <div className="flex flex-col h-full pt-12">
      {/* App container label */}
      <div className="px-5 py-4 border-b border-border/50">
        <p className="text-xs font-mono font-semibold text-primary uppercase tracking-widest">{activeContainer}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleFeatures.map((item) => {
          const Icon = ICON_MAP[item.label] || LayoutDashboard;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive(item.path)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", isActive(item.path) && "text-primary")} />
              <span className="truncate">{item.label}</span>
              {isActive(item.path) && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Active project badge */}
      <div className="px-5 py-4 border-t border-border/50">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse-glow shrink-0" />
          <span className="text-xs font-mono text-muted-foreground truncate">
            {activeProject ? activeProject.name : 'no project'}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop toggle icon */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className={cn(
          "fixed top-20 lg:top-20 z-50 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-300",
          isVisible ? "left-60" : "left-1"
        )}
        title={isVisible ? 'Hide sidebar' : 'Show sidebar'}
      >
        {isVisible ? <ChevronRight className="w-4 h-4" /> : <ChevronRight className="w-4 h-4 rotate-180" />}
      </button>

      {/* Mobile toggle icon */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-20 left-1 z-50 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50"
      >
        {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-screen w-60 bg-sidebar border-r border-border z-40 transition-transform duration-300",
        isVisible ? "translate-x-0" : "-translate-x-full"
      )}>
        <NavContent />
      </aside>
    </>
  );
}