/**
 * odrlApi.js — Framework-agnostic OpenREL KB API client.
 *
 * Talks ONLY to the public apiProxy gateway (CORS *, service-role, no auth),
 * so a standalone HTML file with no Base44 SDK can read all KB sections.
 *
 * Reusable by the standalone HTML build and by the React app.
 */

const DEFAULT_BASE = 'https://openrel-platform-poc.base44.app/functions/apiProxy';

export function createApiClient(baseUrl = DEFAULT_BASE) {
  async function get(apiPath, params = {}) {
    // apiProxy matches endpoints by HTTP method; the real verb is carried in
    // `_method` so we can POST a JSON body (SDK-style) while targeting GET routes.
    const body = { api_path: apiPath, _method: 'GET', ...params };
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let msg = `API ${res.status}`;
      try { const j = await res.json(); if (j && j.error) msg += ': ' + j.error; } catch (_) {}
      throw new Error(msg);
    }
    const json = await res.json();
    if (json && json.error) throw new Error(json.error);
    return json;
  }

  return {
    baseUrl,
    listPolicies: () => get('/openrel/api/v0.4/policies'),
    getPolicyRaw: async (id) => {
      const j = await get('/openrel/api/v0.4/policies/' + encodeURIComponent(id), { format: 'ttl' });
      if (j && j._content_type === 'text/turtle' && j._raw_body != null) return j._raw_body;
      throw new Error('Expected raw TTL for ' + id + ', got ' + (j && j._content_type));
    },
    getPolicyJson: (id) => get('/openrel/api/v0.4/policies/' + encodeURIComponent(id), { keep_properties: true }),
    listActions: () => get('/openrel/api/v0.4/actions'),
    listConstraints: () => get('/openrel/api/v0.4/constraints'),
    listCountries: () => get('/openrel/api/v0.4/countries'),
    listParameters: () => get('/openrel/api/v0.4/parameters'),
    listScenarios: () => get('/openrel/api/v0.4/scenarios'),
  };
}
