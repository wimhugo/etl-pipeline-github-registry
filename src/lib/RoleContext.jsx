import React, { createContext, useContext, useState, useCallback } from 'react';

export const ROLES = ['Administrator', 'Curator', 'Contributor', 'End User'];
export const NON_ADMIN_ROLES = ['Curator', 'Contributor', 'End User'];
export const APP_CONTAINERS = ['KB Manager', 'KB User'];

// Default feature definitions — Administrator always has access to everything
export const KB_MANAGER_FEATURES_DEFAULT = [
  { label: 'Dashboard',            path: '/',                   access: { Administrator: true, Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Projects',             path: '/projects',           access: { Administrator: true, Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Knowledge Bases',      path: '/knowledge-bases',    access: { Administrator: true, Curator: true,  Contributor: false, 'End User': false } },
  { label: 'ETL Pipeline',         path: '/pipelines',          access: { Administrator: true, Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Schema Validator',     path: '/schema-validator',   access: { Administrator: true, Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Template Manager',     path: '/template-manager',   access: { Administrator: true, Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Schema Extraction',    path: '/schema-extraction',  access: { Administrator: true, Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Data Sync',            path: '/data-sync',          access: { Administrator: true, Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Vocabulary Linker',    path: '/vocab-linker',       access: { Administrator: true, Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Vocabulary Maker',     path: '/vocab-maker',        access: { Administrator: true, Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Manual Vocab Links',   path: '/vocab-links',        access: { Administrator: true, Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Annotation Notes',     path: '/annotation-notes',   access: { Administrator: true, Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Populate Sub-Objects', path: '/populate-subobjects',access: { Administrator: true, Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Provenance Viewer',    path: '/provenance',         access: { Administrator: true, Curator: true,  Contributor: true,  'End User': true  } },
  { label: 'Settings',             path: '/config',             access: { Administrator: true, Curator: false, Contributor: false, 'End User': false } },
];

export const KB_USER_FEATURES_DEFAULT = [
  { label: 'Dashboard',   path: '/kb-user/dashboard',   access: { Administrator: true, Curator: true, Contributor: true,  'End User': true  } },
  { label: 'Search',      path: '/kb-user/search',      access: { Administrator: true, Curator: true, Contributor: true,  'End User': true  } },
  { label: 'Annotate',    path: '/kb-user/annotate',    access: { Administrator: true, Curator: true, Contributor: true,  'End User': false } },
  { label: 'Match',       path: '/kb-user/match',       access: { Administrator: true, Curator: true, Contributor: true,  'End User': true  } },
  { label: 'Compose',     path: '/kb-user/compose',     access: { Administrator: true, Curator: true, Contributor: true,  'End User': false } },
  { label: 'Preferences',    path: '/kb-user/preferences',    access: { Administrator: true, Curator: true, Contributor: true,  'End User': false } },
  { label: 'Configuration',  path: '/kb-user/configuration',  access: { Administrator: true, Curator: true, Contributor: false, 'End User': false } },
];

const PERMISSIONS_KEY = 'openrel_permissions';
const ROLE_KEY = 'openrel_active_role';
const CONTAINER_KEY = 'openrel_app_container';

const RoleContext = createContext(null);

function loadPermissions() {
  try {
    const stored = localStorage.getItem(PERMISSIONS_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Merge stored overrides into the default feature list.
// Administrator access is always forced to true.
function applyPermissions(defaults, overrides) {
  if (!overrides) return defaults;
  return defaults.map(f => {
    const saved = overrides[f.path];
    if (!saved) return f;
    return {
      ...f,
      access: {
        ...saved,
        Administrator: true, // always locked
      },
    };
  });
}

export function RoleProvider({ children }) {
  const [activeRole, setActiveRole] = useState(
    () => localStorage.getItem(ROLE_KEY) || 'Administrator'
  );
  const [activeContainer, setActiveContainer] = useState(
    () => localStorage.getItem(CONTAINER_KEY) || 'KB Manager'
  );
  const [permissionOverrides, setPermissionOverrides] = useState(loadPermissions);

  const selectRole = (role) => {
    setActiveRole(role);
    localStorage.setItem(ROLE_KEY, role);
  };

  const selectContainer = (container) => {
    setActiveContainer(container);
    localStorage.setItem(CONTAINER_KEY, container);
  };

  const savePermissions = useCallback((overrides) => {
    setPermissionOverrides(overrides);
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(overrides));
  }, []);

  const kbManagerFeatures = applyPermissions(KB_MANAGER_FEATURES_DEFAULT, permissionOverrides);
  const kbUserFeatures = applyPermissions(KB_USER_FEATURES_DEFAULT, permissionOverrides);

  const features = activeContainer === 'KB Manager' ? kbManagerFeatures : kbUserFeatures;
  const visibleFeatures = features.filter(f => f.access[activeRole]);

  return (
    <RoleContext.Provider value={{
      activeRole, selectRole,
      activeContainer, selectContainer,
      visibleFeatures, features,
      kbManagerFeatures, kbUserFeatures,
      permissionOverrides, savePermissions,
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}