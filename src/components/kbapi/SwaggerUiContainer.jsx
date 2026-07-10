import React, { useEffect, useRef } from 'react';

let loadPromise = null;

function loadSwaggerUi() {
  if (window.SwaggerUIBundle) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Swagger UI'));
    document.head.appendChild(script);
  });

  return loadPromise;
}

export default function SwaggerUiContainer({ spec }) {
  const containerRef = useRef(null);
  const uiRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    loadSwaggerUi().then(() => {
      if (cancelled || !containerRef.current) return;
      containerRef.current.innerHTML = '';
      uiRef.current = window.SwaggerUIBundle({
        dom_node: containerRef.current,
        spec: spec,
        presets: [window.SwaggerUIBundle.presets.apis],
        deepLinking: true,
      });
    }).catch(() => {
      if (containerRef.current && !cancelled) {
        containerRef.current.innerHTML = '<p style="color:#94a3b8;padding:1rem">Failed to load Swagger UI.</p>';
      }
    });

    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [spec]);

  return (
    <div className="swagger-ui-dark-wrapper">
      <div ref={containerRef} />
    </div>
  );
}