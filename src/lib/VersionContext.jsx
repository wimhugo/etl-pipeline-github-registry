import React, { createContext, useContext, useState } from 'react';

const VERSION_KEY = 'openrel_version';

export const VERSIONS = [
  { value: 'v0.3', label: 'OpenREL 0.3' },
  { value: 'v0.4', label: 'OpenREL 0.4' },
];

const VersionContext = createContext(null);

export function VersionProvider({ children }) {
  const [version, setVersion] = useState(
    () => localStorage.getItem(VERSION_KEY) || 'v0.3'
  );

  const selectVersion = (v) => {
    setVersion(v);
    localStorage.setItem(VERSION_KEY, v);
  };

  return (
    <VersionContext.Provider value={{ version, selectVersion, versions: VERSIONS }}>
      {children}
    </VersionContext.Provider>
  );
}

export function useVersion() {
  return useContext(VersionContext);
}