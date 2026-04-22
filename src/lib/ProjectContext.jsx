import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

const ProjectContext = createContext(null);

const STORAGE_KEY = 'openrel_active_project_id';

export function ProjectProvider({ children }) {
  const [activeProjectId, setActiveProjectId] = useState(
    () => localStorage.getItem(STORAGE_KEY) || null
  );

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date'),
  });

  // Resolve active project object
  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0] || null;

  // Keep localStorage in sync
  useEffect(() => {
    if (activeProject?.id) {
      localStorage.setItem(STORAGE_KEY, activeProject.id);
    }
  }, [activeProject?.id]);

  const selectProject = (id) => {
    setActiveProjectId(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  return (
    <ProjectContext.Provider value={{ projects, activeProject, selectProject, isLoading }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}