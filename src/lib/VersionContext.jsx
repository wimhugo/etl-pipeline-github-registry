import React, { createContext, useContext, useState, useEffect } from 'react';

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

  // Sync version with the current URL on startup — prevents mismatch
  // when the user reloads a /v0.4/ route but localStorage still says v0.3
  useEffect(() => {
    const path = window.location.pathname;
    const urlVersion = path.startsWith('/v0.4') ? 'v0.4' : 'v0.3';
    if (urlVersion !== version) {
      setVersion(urlVersion);
      localStorage.setItem(VERSION_KEY, urlVersion);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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