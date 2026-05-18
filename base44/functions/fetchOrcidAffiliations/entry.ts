import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { orcid } = await req.json();
  if (!orcid) return Response.json({ error: 'ORCID is required' }, { status: 400 });

  const clean = orcid.trim().replace(/^https?:\/\/orcid\.org\//, '');

  const headers = { 'Accept': 'application/json' };
  const base = `https://pub.orcid.org/v3.0/${clean}`;

  const [empRes, eduRes, personRes] = await Promise.all([
    fetch(`${base}/employments`, { headers }),
    fetch(`${base}/educations`, { headers }),
    fetch(`${base}/person`, { headers }),
  ]);

  if (!empRes.ok && !eduRes.ok) {
    return Response.json({ error: `ORCID record not found for ${clean}` }, { status: 404 });
  }

  // Extract country from ORCID person record
  let orcid_country = null;
  if (personRes.ok) {
    const personData = await personRes.json();
    orcid_country = personData?.['addresses']?.['address']?.[0]?.['country']?.['value'] || null;
  }

  const institutions = [];

  const parseAffiliation = (item, type) => {
    const org = item['organization'];
    const address = org?.['address'];
    return {
      name: org?.['name'] || '',
      department: item['department-name'] || '',
      role: item['role-title'] || '',
      start_year: item['start-date']?.['year']?.['value'] || '',
      end_year: item['end-date']?.['year']?.['value'] || '',
      city: address?.['city'] || '',
      country: address?.['country'] || '',
      type,
    };
  };

  if (empRes.ok) {
    const empData = await empRes.json();
    const groups = empData?.['affiliation-group'] || [];
    for (const group of groups) {
      const summaries = group?.['summaries'] || [];
      for (const s of summaries) {
        const item = s?.['employment-summary'];
        if (item) institutions.push(parseAffiliation(item, 'employment'));
      }
    }
  }

  if (eduRes.ok) {
    const eduData = await eduRes.json();
    const groups = eduData?.['affiliation-group'] || [];
    for (const group of groups) {
      const summaries = group?.['summaries'] || [];
      for (const s of summaries) {
        const item = s?.['education-summary'];
        if (item) institutions.push(parseAffiliation(item, 'education'));
      }
    }
  }

  return Response.json({ institutions, orcid_country });
});