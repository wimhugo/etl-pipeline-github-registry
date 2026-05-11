import React, { createContext, useContext, useState } from 'react';

export const ROLES = ['Administrator', 'Curator', 'Contributor', 'End User'];
export const APP_CONTAINERS = ['KB Manager', 'KB User'];

// Feature access: KB Manager
// Format: { [feature]: { [role]: boolean } }
export const KB_MANAGER_FEATURES = [
  { label: 'Dashboard',           path: '/',                  access: { Administrator: true,  Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Projects',            path: '/projects',          access: { Administrator: true,  Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Knowledge Bases',     path: '/knowledge-bases',   access: { Administrator: true,  Curator: true,  Contributor: false, 'End User': false } },
  { label: 'ETL Pipeline',        path: '/pipelines',         access: { Administrator: true,  Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Schema Validator',    path: '/schema-validator',  access: { Administrator: true,  Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Template Manager',    path: '/template-manager',  access: { Administrator: true,  Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Schema Extraction',   path: '/schema-extraction', access: { Administrator: true,  Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Data Sync',           path: '/data-sync',         access: { Administrator: true,  Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Vocabulary Linker',   path: '/vocab-linker',      access: { Administrator: true,  Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Vocabulary Maker',    path: '/vocab-maker',       access: { Administrator: true,  Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Manual Vocab Links',  path: '/vocab-links',       access: { Administrator: true,  Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Annotation Notes',    path: '/annotation-notes',  access: { Administrator: true,  Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Populate Sub-Objects',path: '/populate-subobjects',access:{ Administrator: true,  Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Provenance Viewer',   path: '/provenance',        access: { Administrator: true,  Curator: true,  Contributor: true,  'End User': true  } },
  { label: 'Settings',            path: '/config',            access: { Administrator: true,  Curator: false, Contributor: false, 'End User': false } },
];

// Feature access: KB User
export const KB_USER_FEATURES = [
  { label: 'Dashboard',   path: '/kb-user/dashboard',   access: { Administrator: true, Curator: true, Contributor: true,  'End User': true  } },
  { label: 'Search',      path: '/kb-user/search',      access: { Administrator: true, Curator: true, Contributor: true,  'End User': true  } },
  { label: 'Annotate',    path: '/kb-user/annotate',    access: { Administrator: true, Curator: true, Contributor: true,  'End User': false } },
  { label: 'Match',       path: '/kb-user/match',       access: { Administrator: true, Curator: true, Contributor: true,  'End User': true  } },
  { label: 'Compose',     path: '/kb-user/compose',     access: { Administrator: true, Curator: true, Contributor: true,  'End User': false } },
  { label: 'Preferences', path: '/kb-user/preferences', access: { Administrator: true, Curator: true, Contributor: true,  'End User': false } },
];

const RoleContext = createContext(null);

const ROLE_KEY = 'openrel_active_role';
const CONTAINER_KEY = 'openrel_app_container';

export function RoleProvider({ children }) {
  const [activeRole, setActiveRole] = useState(
    () => localStorage.getItem(ROLE_KEY) || 'Administrator'
  );
  const [activeContainer, setActiveContainer] = useState(
    () => localStorage.getItem(CONTAINER_KEY) || 'KB Manager'
  );

  const selectRole = (role) => {
    setActiveRole(role);
    localStorage.setItem(ROLE_KEY, role);
  };

  const selectContainer = (container) => {
    setActiveContainer(container);
    localStorage.setItem(CONTAINER_KEY, container);
  };

  const features = activeContainer === 'KB Manager' ? KB_MANAGER_FEATURES : KB_USER_FEATURES;
  const visibleFeatures = features.filter(f => f.access[activeRole]);

  return (
    <RoleContext.Provider value={{ activeRole, selectRole, activeContainer, selectContainer, visibleFeatures, features }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}