import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Code2, Database, Gauge } from 'lucide-react';

const TRL_LABELS = {
  1: 'Basic principles observed',
  2: 'Technology concept formulated',
  3: 'Experimental proof of concept',
  4: 'Technology validated in lab',
  5: 'Technology validated in relevant environment',
  6: 'Technology demonstrated in relevant environment',
  7: 'System prototype demonstration',
  8: 'System complete and qualified',
  9: 'Actual system proven in operational environment',
};

export default function ProjectInfoPanel({ project }) {
  if (!project) return null;

  const targetRepoUrl = project.github_repo
    ? `https://github.com/${project.github_repo}`
    : null;

  const hasAnyInfo = project.trl || project.github_code_repo || project.github_repo;
  if (!hasAnyInfo) return null;

  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Gauge className="w-4 h-4" /> Project Info
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-6 text-sm">
        {project.trl && (
          <div className="flex items-start gap-2">
            <Gauge className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Technology Readiness Level</p>
              <p className="font-semibold">TRL {project.trl}</p>
              <p className="text-muted-foreground text-xs">{TRL_LABELS[project.trl]}</p>
            </div>
          </div>
        )}
        {project.github_code_repo && (
          <div className="flex items-start gap-2">
            <Code2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Code Repository</p>
              <a
                href={project.github_code_repo}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                {project.github_code_repo.replace('https://github.com/', '')}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
        {targetRepoUrl && (
          <div className="flex items-start gap-2">
            <Database className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Data Repository</p>
              <a
                href={targetRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                {project.github_repo}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}