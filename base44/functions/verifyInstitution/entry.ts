import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ROR_API = 'https://api.ror.org/v2/organizations';

// ROR types that qualify as academic/research institutions
const VERIFIED_TYPES = new Set(['education', 'facility', 'funder', 'nonprofit', 'government']);
const RESEARCH_TYPES = new Set(['facility', 'funder', 'nonprofit', 'government']);

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (!name || !name.trim()) {
    return Response.json({ error: 'Institution name is required' }, { status: 400 });
  }

  // Search ROR with affiliation matching (best for institution name lookups)
  const url = `${ROR_API}?affiliation=${encodeURIComponent(name.trim())}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });

  if (!res.ok) {
    return Response.json({ status: 'unverified', match: null, error: `ROR API error: ${res.status}` });
  }

  const data = await res.json();
  const items = data.items || [];

  // Affiliation search returns items with { chosen, score, organization: {...} }
  const bestItem = items.find(i => i.chosen) || items[0] || null;

  if (!bestItem) {
    return Response.json({ status: 'unverified', match: null });
  }

  // The actual org data is nested under .organization
  const org = bestItem.organization || bestItem;

  const types = org.types || [];
  const isEducation = types.includes('education');
  const isResearch = types.some(t => RESEARCH_TYPES.has(t));
  const isActive = org.status === 'active';

  // Get the display name
  const displayName = org.names?.find(n => n.types?.includes('ror_display'))?.value
    || org.names?.[0]?.value
    || name;

  // Get country from location
  const location = org.locations?.[0]?.geonames_details;
  const country = location?.country_name || null;
  const countryCode = location?.country_code || null;
  const isEU = location?.continent_code === 'EU';

  // Determine verification status
  let status = 'unverified';
  if (isActive && (isEducation || isResearch)) {
    status = isEducation ? 'verified_education' : 'verified_research';
  }

  return Response.json({
    status,
    match: {
      ror_id: org.id,
      name: displayName,
      types,
      country,
      country_code: countryCode,
      is_eu: isEU,
      is_active: isActive,
      website: org.links?.find(l => l.type === 'website')?.value || null,
      score: bestItem.score || null,
    }
  });
});