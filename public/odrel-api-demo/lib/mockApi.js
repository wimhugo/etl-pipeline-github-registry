/**
 * mockApi.js — Offline request router for the standalone API demo.
 *
 * Mirrors the hosted `fetchApiSourceContent` function: sections resolve to the
 * Turtle files listed in manifest.json (under input/), members are parsed in the
 * browser, and responses are produced in Turtle, JSON or JSON-LD.
 */

const {
  parseTurtle,
  parseJsonMembers,
  membersToTurtle,
  membersToJsonLd,
  resolveCurie,
  findPrimarySubject,
} = window.RDF;

const SKOS_NS = 'http://www.w3.org/2004/02/skos/core#';
const OPENREL_NS = 'http://www.w3.org/ns/openrel/0/';
const EVALUATION_MAPPING_IRI = OPENREL_NS + 'EvaluationMapping';

const MAPPING_INVERSE = {
  'http://www.w3.org/2004/02/skos/core#exactMatch': 'http://www.w3.org/2004/02/skos/core#exactMatch',
  'http://www.w3.org/2004/02/skos/core#closeMatch': 'http://www.w3.org/2004/02/skos/core#closeMatch',
  'http://www.w3.org/2004/02/skos/core#broadMatch': 'http://www.w3.org/2004/02/skos/core#narrowMatch',
  'http://www.w3.org/2004/02/skos/core#narrowMatch': 'http://www.w3.org/2004/02/skos/core#broadMatch',
};

const MAPPING_PREDICATES = new Set([
  'http://www.w3.org/2004/02/skos/core#exactMatch',
  'http://www.w3.org/2004/02/skos/core#closeMatch',
  'http://www.w3.org/2004/02/skos/core#broadMatch',
  'http://www.w3.org/2004/02/skos/core#narrowMatch',
]);

const textCache = new Map();

async function loadManifest() {
  const inlined = window.OPENREL_DATA && window.OPENREL_DATA['manifest.json'];
  if (typeof inlined === 'string') return JSON.parse(inlined);
  const res = await fetch('./manifest.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load manifest.json (${res.status})`);
  return res.json();
}

async function fetchText(localPath) {
  if (textCache.has(localPath)) return textCache.get(localPath);
  const inlined = window.OPENREL_DATA && window.OPENREL_DATA[localPath];
  if (typeof inlined === 'string') {
    textCache.set(localPath, inlined);
    return inlined;
  }
  const res = await fetch('./' + localPath, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Missing bundled data file: ${localPath} (${res.status})`);
  const text = await res.text();
  textCache.set(localPath, text);
  return text;
}

async function parseSource(manifest, section) {
  if (section.data_format === 'json' || section.data_format === 'json-ld') {
    const text = await fetchText(section.files[0].local_path);
    return parseJsonMembers(text, section.member_identifier);
  }
  const combined = { members: [], memberIdentifierResolved: null, prefixes: {}, baseIri: null };
  for (const file of section.files) {
    const text = await fetchText(file.local_path);
    const parsed = parseTurtle(text, section.member_identifier);
    Object.assign(combined.prefixes, parsed.prefixes || {});
    if (!combined.memberIdentifierResolved) combined.memberIdentifierResolved = parsed.memberIdentifierResolved;
    combined.members.push(...(parsed.members || []));
  }
  combined.members = [...new Map(combined.members.map((m) => [m.iri, m])).values()];
  return combined;
}

function cleanLiteral(value) {
  return String(value || '').replace(/^"|"$/g, '').replace(/^"|"$/g, '');
}

function folderId(subjectIri, idPrefix, baseIri) {
  if (!idPrefix) {
    return baseIri && !subjectIri.startsWith('http') && !subjectIri.startsWith('urn')
      ? baseIri + subjectIri
      : subjectIri;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(subjectIri) && !subjectIri.startsWith(idPrefix)) {
    return baseIri && subjectIri.startsWith(baseIri)
      ? idPrefix + subjectIri.substring(baseIri.length)
      : subjectIri;
  }
  return idPrefix + subjectIri;
}

async function readFolderSection(section) {
  const titleField = section.title_field || 'dct:title';
  const descriptionField = section.description_field || 'dct:description';
  const idPrefix = section.id_prefix || '';
  const members = [];
  const byId = {};

  for (const file of section.files) {
    let raw;
    try {
      raw = await fetchText(file.local_path);
    } catch {
      continue;
    }
    const parsed = parseTurtle(raw, null);
    const prefixes = parsed.prefixes || {};
    const titleFieldIri = resolveCurie(titleField, prefixes) || titleField;
    const descriptionFieldIri = resolveCurie(descriptionField, prefixes) || descriptionField;

    const subject = findPrimarySubject(parsed, titleFieldIri, descriptionFieldIri);
    if (!subject) continue;

    const id = folderId(subject.iri, idPrefix, parsed.baseIri || null);
    const label = (subject.properties || []).find((p) => p.predicate === titleFieldIri)?.object || subject.label || '';
    const definition =
      (subject.properties || []).find((p) => p.predicate === descriptionFieldIri)?.object || subject.definition || '';

    members.push({ iri: id, label: cleanLiteral(label), definition: cleanLiteral(definition) });
    byId[id] = { raw, parsed, subject };
  }

  return { members, byId };
}

// The Mappings section is composed from every other source at request time,
// exactly like the hosted function does.
async function composeMappings(manifest) {
  const members = {};
  const allPrefixes = {};

  for (const section of Object.values(manifest.sections)) {
    if (section.is_system) continue;
    if (section.source_mode === 'folder') continue;
    if (!section.files || !section.files.length) continue;

    for (const file of section.files) {
      let parsed;
      try {
        const text = await fetchText(file.local_path);
        parsed = section.data_format === 'json' || section.data_format === 'json-ld'
          ? parseJsonMembers(text, section.member_identifier)
          : parseTurtle(text, section.member_identifier);
      } catch {
        continue;
      }
      Object.assign(allPrefixes, parsed.prefixes || {});

      for (const member of parsed.members || []) {
        if (!Array.isArray(member.properties)) continue;
        for (const prop of member.properties) {
          const inversePred = MAPPING_INVERSE[prop.predicate];
          if (!inversePred || prop.is_literal) continue;
          const externalTerm = prop.object;
          if (!members[externalTerm]) {
            members[externalTerm] = { iri: externalTerm, label: '', definition: '', properties: [] };
          }
          const exists = members[externalTerm].properties.some(
            (p) => p.predicate === inversePred && p.object === member.iri
          );
          if (!exists) {
            members[externalTerm].properties.push({ predicate: inversePred, object: member.iri, is_literal: false });
          }
        }
      }
    }
  }

  return {
    members: Object.values(members),
    memberIdentifierResolved: SKOS_NS + 'Concept',
    prefixes: allPrefixes,
  };
}

function jsonResponse(status, payload) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload, null, 2),
  };
}

function valueOf(properties, predicate) {
  const found = (properties || []).find((p) => p.predicate === predicate);
  return found ? found.object : null;
}

async function buildSectionResponse(manifest, sectionName, params) {
  const section = manifest.sections[sectionName];
  if (!section) {
    return jsonResponse(404, { error: `No API source file found for section "${sectionName}"` });
  }

  const format = (params.format || 'ttl').toLowerCase();
  const requestedId = params.id || null;
  const requestedPrefix = params.prefix || null;

  // ---- Folder mode: one member per file ----
  if (section.source_mode === 'folder') {
    const { members, byId } = await readFolderSection(section);
    let filtered = members;
    if (requestedId) filtered = filtered.filter((m) => m.iri === requestedId);
    if (requestedPrefix) filtered = filtered.filter((m) => String(m.iri).startsWith(requestedPrefix));

    const meta = {
      section: sectionName,
      source_mode: 'folder',
      member_count: filtered.length,
      requested_id: requestedId,
      applied_prefix: requestedPrefix,
    };

    if (requestedId) {
      const entry = filtered[0] ? byId[filtered[0].iri] : null;
      if (!entry) return jsonResponse(404, { ...meta, status: 'not_found', members: [] });

      if (format === 'ttl') {
        return { status: 200, contentType: 'text/turtle', body: entry.raw, meta };
      }
      if (format === 'json-ld') {
        const doc = membersToJsonLd(
          [{ iri: filtered[0].iri, label: filtered[0].label, definition: filtered[0].definition, properties: entry.subject.properties || [] }],
          null,
          entry.parsed.prefixes || {}
        );
        return { status: 200, contentType: 'application/ld+json', body: JSON.stringify(doc, null, 2), meta };
      }
      return jsonResponse(200, {
        status: 'success',
        ...meta,
        members: [{
          iri: filtered[0].iri,
          label: filtered[0].label,
          definition: filtered[0].definition,
          properties: entry.subject.properties || [],
        }],
        prefixes: entry.parsed.prefixes || {},
      });
    }

    if (format === 'ttl') {
      return { status: 200, contentType: 'text/turtle', body: membersToTurtle(filtered, null, {}), meta };
    }
    if (format === 'json-ld') {
      return {
        status: 200,
        contentType: 'application/ld+json',
        body: JSON.stringify(membersToJsonLd(filtered, null, {}), null, 2),
        meta,
      };
    }
    return jsonResponse(200, { status: 'success', ...meta, members: filtered });
  }

  // ---- File mode ----
  let parsed;
  if (section.is_system && sectionName === 'Mappings') {
    parsed = await composeMappings(manifest);
  } else {
    parsed = await parseSource(manifest, section);
  }

  let members = parsed.members || [];

  if (requestedId) members = members.filter((m) => m.iri === requestedId);
  if (requestedPrefix) members = members.filter((m) => String(m.iri).startsWith(requestedPrefix));

  if (!requestedId) {
    if (parsed.memberIdentifierResolved === EVALUATION_MAPPING_IRI) {
      members = members.map(({ iri, properties = [] }) => ({
        iri,
        compared_individual: valueOf(properties, OPENREL_NS + 'comparedIndividual'),
        compared_subject: valueOf(properties, OPENREL_NS + 'comparedSubject'),
        evaluation_outcome: valueOf(properties, OPENREL_NS + 'evaluationOutcome'),
        evaluation_class: valueOf(properties, OPENREL_NS + 'evaluationClass'),
        derivation_type: valueOf(properties, OPENREL_NS + 'derivationType'),
        source_relation: valueOf(properties, OPENREL_NS + 'sourceRelation'),
        derived_from: valueOf(properties, OPENREL_NS + 'wasDerivedFrom'),
        properties,
      }));
    } else if (sectionName === 'Mappings') {
      members = members.map(({ iri, label, properties }) => ({
        iri,
        label,
        mappings: (properties || [])
          .filter((p) => MAPPING_PREDICATES.has(p.predicate))
          .map((p) => ({ predicate: 'skos:' + p.predicate.substring(SKOS_NS.length), object: p.object })),
      }));
    } else {
      members = members.map(({ iri, label, definition, url }) => (
        url ? { iri, label, definition, url } : { iri, label, definition }
      ));
    }
  }

  const meta = {
    section: sectionName,
    member_identifier_resolved: parsed.memberIdentifierResolved,
    member_count: members.length,
    requested_id: requestedId,
    applied_prefix: requestedPrefix,
  };

  if (format === 'ttl') {
    return {
      status: 200,
      contentType: 'text/turtle',
      body: membersToTurtle(members, parsed.memberIdentifierResolved, parsed.prefixes),
      meta,
    };
  }
  if (format === 'json-ld') {
    return {
      status: 200,
      contentType: 'application/ld+json',
      body: JSON.stringify(membersToJsonLd(members, parsed.memberIdentifierResolved, parsed.prefixes), null, 2),
      meta,
    };
  }
  return jsonResponse(200, { status: 'success', ...meta, members });
}

function matchEndpoint(manifest, method, pathname) {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  for (const ep of manifest.endpoints || []) {
    if ((ep.method || 'GET').toUpperCase() !== method) continue;
    const epParts = String(ep.path || '').split('/').filter(Boolean);
    if (epParts.length !== parts.length) continue;
    const pathParams = {};
    let matches = true;
    for (let i = 0; i < epParts.length; i++) {
      const seg = epParts[i];
      const actual = decodeURIComponent(parts[i]);
      if (seg.startsWith('{') && seg.endsWith('}')) {
        pathParams[seg.slice(1, -1)] = actual;
      } else if (seg !== actual) {
        matches = false;
        break;
      }
    }
    if (matches) return { endpoint: ep, pathParams };
  }
  return null;
}

/**
 * Handle one request against the bundled data.
 * `url` is a path plus optional query string, e.g. "/openrel/api/v0.4/actions?format=json".
 */
async function handleRequest(manifest, method, url) {
  const parsedUrl = new URL(url, window.location.href);
  const found = matchEndpoint(manifest, method, parsedUrl.pathname);

  if (!found) {
    return jsonResponse(404, {
      error: `No endpoint matches ${method} ${parsedUrl.pathname}`,
      hint: 'Pick an endpoint from the list, or check the path against manifest.json.',
    });
  }

  const ep = found.endpoint;
  const logic = ep.target_logic_type || 'fetchApiSourceContent';
  if (logic !== 'fetchApiSourceContent') {
    return jsonResponse(501, {
      error: `Endpoint "${ep.path}" is handled by "${logic}", which is not included in this offline bundle.`,
      endpoint: ep.path,
    });
  }

  const query = Object.fromEntries(parsedUrl.searchParams.entries());
  const params = { ...query, ...found.pathParams };
  const section = (ep.logic_config && ep.logic_config.section) || '';
  const result = await buildSectionResponse(manifest, section, params);

  return {
    ...result,
    endpoint: ep,
    url: parsedUrl.pathname + parsedUrl.search,
    section,
  };
}

// Exposed on window so the demo runs as plain scripts, including from file://.
window.MockApi = { loadManifest, handleRequest };
