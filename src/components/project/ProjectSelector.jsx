import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useProject } from '@/lib/ProjectContext';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Copy, FolderKanban, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ProjectSelector() {
  const { projects, activeProject, selectProject } = useProject();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!activeProject) return;
    setDeleting(true);
    await base44.entities.Project.delete(activeProject.id);
    await queryClient.invalidateQueries({ queryKey: ['projects'] });
    selectProject(null);
    setDeleting(false);
    setShowDelete(false);
  };

  const openNew = () => {
    setCloning(false);
    setForm({ name: '', description: '' });
    setShowNew(true);
  };

  const openClone = () => {
    if (!activeProject) return;
    setCloning(true);
    setForm({
      name: `${activeProject.name} (copy)`,
      description: activeProject.description || '',
      github_token: activeProject.github_token || '',
      github_username: activeProject.github_username || '',
      github_repo: activeProject.github_repo || '',
      github_branch: activeProject.github_branch || 'main',
      github_configs_folder: activeProject.github_configs_folder || '.openrel/pipelines',
      github_output_folder: activeProject.github_output_folder || 'data',
      namespace: activeProject.namespace || 'openrel',
    });
    setShowNew(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const created = await base44.entities.Project.create(form);
    await queryClient.invalidateQueries({ queryKey: ['projects'] });
    selectProject(created.id);
    setSaving(false);
    setShowNew(false);
  };

  return (
    <div className="flex items-center gap-2">
      <FolderKanban className="w-4 h-4 text-muted-foreground shrink-0" />
      <Select
        value={activeProject?.id || ''}
        onValueChange={selectProject}
      >
        <SelectTrigger className="h-8 text-sm bg-muted/50 border-border/50 min-w-[180px]">
          <SelectValue placeholder="Select project…" />
        </SelectTrigger>
        <SelectContent>
          {projects.map(p => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button size="sm" variant="ghost" onClick={openNew} className="h-8 w-8 p-0" title="New project">
        <Plus className="w-4 h-4" />
      </Button>
      {activeProject && (
        <Button size="sm" variant="ghost" onClick={openClone} className="h-8 w-8 p-0" title="Clone project">
          <Copy className="w-4 h-4" />
        </Button>
      )}
      {activeProject && (
        <Button size="sm" variant="ghost" onClick={() => setShowDelete(true)} className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" title="Delete project">
          <Trash2 className="w-4 h-4" />
        </Button>
      )}

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{activeProject?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project. Pipelines assigned to it will not be deleted but will become unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
              {deleting ? 'Deleting…' : 'Delete Project'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{cloning ? 'Clone Project' : 'New Project'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Project Name</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="My Project"
                className="bg-muted/50 text-sm"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description (optional)</Label>
              <Input
                value={form.description || ''}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What is this project for?"
                className="bg-muted/50 text-sm"
              />
            </div>
            {cloning && (
              <p className="text-xs text-muted-foreground">
                GitHub credentials and settings will be copied. Pipelines start empty.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? 'Creating…' : cloning ? 'Clone Project' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}