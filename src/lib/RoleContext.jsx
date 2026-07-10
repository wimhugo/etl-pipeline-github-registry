import React, { createContext, useContext, useState, useCallback } from 'react';
import { useVersion } from './VersionContext';

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
  { label: 'Vocabulary Manager',   path: '/vocabulary-manager', access: { Administrator: true, Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Vocabulary Linker',    path: '/vocab-linker',       access: { Administrator: true, Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Vocabulary Maker',     path: '/vocab-maker',        access: { Administrator: true, Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Manual Vocab Links',   path: '/vocab-links',        access: { Administrator: true, Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Annotation Notes',     path: '/annotation-notes',   access: { Administrator: true, Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Populate Sub-Objects', path: '/populate-subobjects',access: { Administrator: true, Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Provenance Viewer',    path: '/provenance',         access: { Administrator: true, Curator: true,  Contributor: true,  'End User': true  } },
  { label: 'Checklist Manager',    path: '/checklist-manager',  access: { Administrator: true, Curator: true,  Contributor: false, 'End User': false } },
  { label: 'Settings',             path: '/config',             access: { Administrator: true, Curator: false, Contributor: false, 'End User': false } },
];

export const WORKFLOW_TYPES_DEFAULT = [
  { label: 'Licence a Resource',        path: 'workflow_type:licence',         access: { Administrator: true, Curator: true, Contributor: true,  'End User': true  } },
  { label: 'Reuse a Resource',          path: 'workflow_type:reuse',           access: { Administrator: true, Curator: true, Contributor: true,  'End User': true  } },
  { label: 'Policy/Licence Analysis',   path: 'workflow_type:policy_analysis', access: { Administrator: true, Curator: true, Contributor: true,  'End User': false } },
];

export const KB_USER_FEATURES_DEFAULT = [
  { label: 'Dashboard',      path: '/kb-user/dashboard',      access: { Administrator: true, Curator: true, Contributor: true,  'End User': true  } },
  { label: 'My Workflows',   path: '/kb-user/workflow',       access: { Administrator: true, Curator: true, Contributor: true,  'End User': true  } },
  { label: 'Search',         path: '/kb-user/search',         access: { Administrator: true, Curator: true, Contributor: true,  'End User': true  } },
  { label: 'Annotate',       path: '/kb-user/annotate',       access: { Administrator: true, Curator: true, Contributor: true,  'End User': false } },
  { label: 'Match',          path: '/kb-user/match',          access: { Administrator: true, Curator: true, Contributor: true,  'End User': true  } },
  { label: 'Compose',        path: '/kb-user/compose',        access: { Administrator: true, Curator: true, Contributor: true,  'End User': false } },
  { label: 'Preferences',    path: '/kb-user/preferences',    access: { Administrator: true, Curator: true, Contributor: true,  'End User': false } },
  { label: 'Configuration',  path: '/kb-user/configuration',  access: { Administrator: true, Curator: true, Contributor: false, 'End User': false } },
];

export const KB_MANAGER_V04_FEATURES = [
  { label: 'Dashboard', path: '/v0.4/dashboard', access: { Administrator: true, Curator: true, Contributor: true, 'End User': true } },
  { label: 'Settings',  path: '/v0.4/settings',  access: { Administrator: true, Curator: false, Contributor: false, 'End User': false } },
];

export const KB_USER_V04_FEATURES = [
  { label: 'Dashboard', path: '/v0.4/kb-user/dashboard', access: { Administrator: true, Curator: true, Contributor: true, 'End User': true } },
];

export const KB_API_V04_FEATURES = [
  { label: 'Dashboard', path: '/v0.4/kb-api', access: { Administrator: true, Curator: true, Contributor: true, 'End User': true } },
  { label: 'Configuration', path: '/v0.4/kb-api/configuration', access: { Administrator: true, Curator: true, Contributor: false, 'End User': false } },
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
  const { version } = useVersion();
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
  const workflowTypes = applyPermissions(WORKFLOW_TYPES_DEFAULT, permissionOverrides);

  const kbManagerV04 = applyPermissions(KB_MANAGER_V04_FEATURES, permissionOverrides);
  const kbUserV04 = applyPermissions(KB_USER_V04_FEATURES, permissionOverrides);
  const kbApiV04 = applyPermissions(KB_API_V04_FEATURES, permissionOverrides);

  const appContainers = version === 'v0.4'
    ? ['KB Manager', 'KB User', 'KB API']
    : ['KB Manager', 'KB User'];

  let features;
  if (version === 'v0.4') {
    features = activeContainer === 'KB Manager' ? kbManagerV04
      : activeContainer === 'KB User' ? kbUserV04
      : kbApiV04;
  } else {
    features = activeContainer === 'KB Manager' ? kbManagerFeatures : kbUserFeatures;
  }
  const visibleFeatures = features.filter(f => f.access[activeRole]);

  const allowedWorkflowTypes = workflowTypes
    .filter(wt => wt.access[activeRole])
    .map(wt => wt.path.replace('workflow_type:', ''));

  return (
    <RoleContext.Provider value={{
      activeRole, selectRole,
      activeContainer, selectContainer,
      visibleFeatures, features,
      kbManagerFeatures, kbUserFeatures,
      workflowTypes, allowedWorkflowTypes,
      permissionOverrides, savePermissions,
      appContainers,
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}