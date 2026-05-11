import React from 'react';
import { useProject } from '@/lib/ProjectContext';
import ProjectSelector from '@/components/project/ProjectSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderOpen, GitBranch, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function Projects() {
  const { projects, activeProject } = useProject();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your OpenREL projects</p>
        </div>
        <ProjectSelector />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map(project => (
          <Card
            key={project.id}
            className={`bg-card border-border/50 cursor-pointer transition-all hover:border-primary/40 ${activeProject?.id === project.id ? 'border-primary/60 ring-1 ring-primary/20' : ''}`}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-primary" />
                {project.name}
                {activeProject?.id === project.id && (
                  <span className="ml-auto text-xs text-primary font-normal">Active</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {project.description && <p className="text-sm">{project.description}</p>}
              {project.github_repo && (
                <div className="flex items-center gap-1.5 text-xs font-mono">
                  <GitBranch className="w-3.5 h-3.5" />
                  {project.github_repo}
                </div>
              )}
              {project.created_date && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Calendar className="w-3.5 h-3.5" />
                  Created {format(new Date(project.created_date), 'MMM d, yyyy')}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {projects.length === 0 && (
          <div className="col-span-3 text-center py-16 text-sm text-muted-foreground">
            No projects yet. Use the selector above to create one.
          </div>
        )}
      </div>
    </div>
  );
}