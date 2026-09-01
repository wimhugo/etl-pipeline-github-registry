import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { resolveGithubCredentials } from '../../shared/resolveGithubCredentials.ts';

// Serves the curated Policy Index (data/input/policy_index.json) as a raw JSON
// document. fetchApiSourceContent is not used here because it reshapes JSON
// into skos:Concept-style members; the wizard needs the whole document
// ({ version, policies[] }) intact. This is the discovery path described in
// docs/specifications/e.2 §6.7.

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const creds = await resolveGithubCredentials(base44, {});
  const token = creds.token;
  const repo = creds.githubRepo;
  const branch = creds.branch;
  if (!token || !repo) {
    return Response.json({ error: 'GitHub credentials not configured' }, { status: 500 });
  }

  const filePath = 'data/input/policy_index.json';
  const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(filePath)}?ref=${branch}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'OpenREL-App',
    },
  });

  if (!res.ok) {
    const err = await res.text();
    return Response.json({ error: `Failed to fetch policy index (${res.status}): ${err}` }, { status: 500 });
  }

  const data = await res.json();
  const content = JSON.parse(atob(data.content.replace(/\n/g, '')));
  return Response.json(content);
});