# E.2 — UI ↔ API Migration Plan: Policy Wizard

*Consolidated plan for converting the OpenREL Policy Wizard from hardcoded JSON to data served by the OpenREL KB API, incorporating the gap analysis, the refinements (parameter system reuse; scenario-based tags), and the **Policy Index** discovery architecture.*

---

## 1. Context and scope

This plan supersedes the open-decisions table in `e.1 UI API.md` by resolving each one against the *current* content of the OpenREL vocab and policy files. It assumes:

- The `fetchApiSourceContent` backend function already works (file + folder mode) and parses TTL/JSON/JSON-LD/YAML.
- The `jsonToTtl` → `submitPolicyPR` write path already works.
- The wizard mock (`data/input/v0.4/OpenREL_Wizard_mock.html`) is the functional baseline; the goal is to preserve its behaviour while sourcing data from the API.

The plan covers four work streams, executed in order:

1. **Data cleanups** — fix TTL syntax errors in vocab files the adapter will depend on.
2. **New API sections** — register `ApiSourceFile` entries for vocabularies the wizard needs, including the **Policy Index**.
3. **Property additions** — enrich existing source files with the minimal predicates the adapter requires (policy TTLs are **not** altered for simple-mode — see Decision 3).
4. **Adapter** — a client-side module per source that fetches from the API and returns the exact shape the UI consumes.

---

## 2. Decisions taken

| # | Decision (from gap analysis) | Choice | Rationale |
|---|---|---|---|
| 1 | Advanced Wizard port | **Option B** — read real `data/policy/` ODRL, near-zero UI change | Real policies are already ODRL; only action-category metadata is missing |
| 2 | Browser tags/topics | **Hybrid** — reuse `dct:subject` + `type_scenario.ttl`; add `openrel:policyStatus` | Avoids inventing `openrel:topic`; scenarios already exist and constraints already link to them |
| 3 | Simple Wizard port | **Policy Index** — a curated JSON sidecar (`policy_index.json`) carries q1–q4, simple action lists, geo, dates, tags | TTLs stay canonical ODRL; no `openrel:simple*` predicates pollute 20+ policy files; index is the scalable retrieval path for millions of future policies |
| 4 | Constraint parameters | **Reuse existing `openrel:Parameter` system** — do NOT invent `openrel:hasParam`/`openrel:paramType` | The Parameter + ParameterBindingSource vocabularies already model this richer than the mock, and are future-proof for Assertion-policy binding |
| 5 | Policy discovery / retrieval | **Policy Index JSON** served via a `PolicyIndex` API section | Replaces the folder-mode list as the primary discovery path; designed to back an Elasticsearch catalogue with zero UI change |
| 6 | Duplicate check | **Client-side** against index fingerprints | ~20 templates now; index carries fingerprints so the check needs no extra API call |
| 7 | Save | Reuse `jsonToTtl` → `submitPolicyPR` | Already implemented; writes a TTL, the indexer picks it up on its next run |
| 8 | Countries source | New `Countries` ApiSourceFile section | Data file already exists with the right predicates |
| 9 | q2 (Simple Wizard "What") | **Action IRI lists** (`simplePerm`, `simpleDuty`, optional `simpleProhibit`) in the index | More flexible than 7 fixed booleans; covers OpenREL-specific actions; new actions need no schema change; aligns Simple with Advanced |

### 2.1 The Policy Index principle

The index is an **interface, not a file**. The wizard calls `loadPolicyIndex()` and never knows whether the answer comes from a JSON file today or an Elasticsearch query tomorrow. Today's implementation fetches a static JSON; when the catalogue grows, only the adapter is swapped — no UI rework.

### 2.2 Auto-derived vs curated fields

The periodic indexer splits the index fields into two classes:

| Class | Fields | Source |
|---|---|---|
| **Auto-derived** (from TTL) | `iri`, `label`, `description`, `type`, `is_composite`, `hasPolicy`, structural perm/proh/duty action lists, `fingerprint` | Parsed from `data/policy/*.ttl` by the indexer |
| **Curated** (human) | `q1` (Who), `simplePerm`/`simpleDuty`/`simpleProhibit` (Simple Wizard summary), `q3` (Where), `geoInc`/`geoExc`, `q4` (When), `dateStart`/`dateEnd`, `tags`, `status` | Authored in the index by a curator |

The indexer overwrites auto-derived fields on each run and **preserves** curated fields. It flags any entry whose TTL fingerprint differs from the stored fingerprint, so the curator is alerted (not silently overwritten) when a structural change might invalidate a curated summary.

---

## 3. Work stream 1 — Data cleanups (prerequisite)

The wizard adapter will silently lose data if these files are not fixed first. The TTL parser is tolerant but cannot recover missing statement terminators or wrong prefixes.

> Note: with the Policy Index approach (Decision 3), **policy TTLs no longer need `openrel:simple*` predicate additions**. The cleanups below concern *vocabulary* files the adapter still reads directly.

### 3.1 `parameters.ttl`

| Issue | Fix |
|---|---|
| `oprenrel:` typos (multiple instances) | → `openrel:` |
| `openrel: parameterAssigneeIRI` (stray space) | → `openrel:parameterAssigneeIRI` |
| `openrel:Parameter` class block: missing `.` after `rdfs:label "Parameters"@en`, causing `skos:prefLabel`/`dct:*` lines to be absorbed | add terminating `.` |
| `openrel:ParameterSCheme` — verify it is the intended ConceptScheme name (likely `ParameterScheme`) | confirm naming; fix if a typo |

### 3.2 `type_scenario.ttl`

| Issue | Fix |
|---|---|
| `skos:definiton` typos (many) | → `skos:definition` |
| Missing `.` terminators on `openrel:legal-considerations`, `openrel:ethics-considerations`, `openrel:obligations`, `openrel:notification-duty` (no `skos:inScheme`, no `.`) | add `; skos:inScheme openrel:typeScenario .` or terminate cleanly |
| `rdfs:label` vs `skos:prefLabel` inconsistency on scenario leaves | standardize to `skos:prefLabel` for leaf concepts |

### 3.3 `actions.ttl`, `constraints.ttl`, `countries.ttl`

No blocking syntax errors observed; revisit if the adapter surfaces missing members.

---

## 4. Work stream 2 — New API sections (register `ApiSourceFile` entities)

All are served by the existing `fetchApiSourceContent` function — no new backend function required.

| Section | file_path | source_mode | data_format | member_identifier / notes | Wizard use |
|---|---|---|---|---|---|
| **PolicyIndex** | `data/input/policy_index.json` | file | **json** | top-level `policies[]` array | Browser grid + Simple Wizard preload (primary discovery path) |
| **Countries** | `data/input/countries.ttl` | file | ttl | `skos:Concept` (or whatever the file declares) | Simple Q3 / Advanced geo pickers |
| **Parameters** | `.openrel/vocabs/openrel/parameters.ttl` | file | ttl | `openrel:Parameter` | Constraint parametric inputs (refinement 1) |
| **Parameter Bindings** | `.openrel/vocabs/openrel/type_parameter_binding.ttl` | file | ttl | `openrel:ParameterBindingSource` | Decide whether a param renders an input, is pre-filled, or is read-only |
| **Scenarios** | `.openrel/vocabs/openrel/type_scenario.ttl` | file | ttl | `skos:Concept` | Browser tag/topic axis (refinement 2) |
| **Policies** | `data/policy/` | **folder** | ttl | `id_prefix: "openrel:"`, `title_field: dct:title`, `description_field: dct:description` | **Detail only** — rules/constraints for the Advanced Wizard and the modal |

> The `Policies` folder-mode section is now the **detail** source, not the discovery list. The index drives discovery; the TTLs drive detail. This is the discovery/detail split the standalone wizard already implements (index → card, TTL → modal).

---

## 5. Work stream 3 — Property additions

Minimal, well-defined additions to existing source files. Each is expressed as the predicate the adapter will read.

### 5.1 Actions (`actions.ttl`) — add category + default-duty metadata

The Advanced Wizard routes each action to the permission / prohibition / obligation grid. Currently absent.

| Predicate | Value type | Example | Used by |
|---|---|---|---|
| `openrel:actionCategory` | repeated literal | `"perm"`, `"proh"`, `"obli"` | Advanced steps 3/4/5 grid placement |
| `openrel:defaultDuty` | literal | `"preDuty"` / `"postDuty"` | Default duty type when action is an obligation |

~14 actions × 1–3 category literals + 1 default-duty literal.

#### 5.1.1 Extracted mock-up values (`OpenREL_Wizard_mock.html`)

| Action | Category | Default Duty |
|---|---|---|
| Use (`odrl:use`) | perm, proh, obli | — |
| Read (`odrl:read`) | perm, proh | — |
| Distribute (`odrl:distribute`) | perm, proh, obli | — |
| Modify (`odrl:modify`) | perm, proh | — |
| Reproduce (`odrl:reproduce`) | perm, proh | — |
| Archive (`odrl:archive`) | perm, proh, obli | — |
| Delete (`odrl:delete`) | perm, proh, obli | — |
| Notify (`openrel:notify`) | perm, obli | — |
| Log (`openrel:log`) | perm, obli | — |
| Attribute (`odrl:attribute`) | perm, obli | postDuty |
| Obtain Consent (`openrel:obtainConsent`) | obli | preDuty |
| Anonymize (`openrel:anonymize`) | perm, obli | — |
| Encrypt (`openrel:encrypt`) | perm, obli | preDuty |
| Apply License (`openrel:applyLicense`) | perm, obli | — |

### 5.2 Policies (`data/policy/*.ttl`) — detail only; **no simple-mode additions**

With the Policy Index approach, policy TTLs are **not** altered for the Simple Wizard. The browser card status/tags and the Simple Wizard preload all live in the index. The TTLs only need the properties they already carry (`odrl:permission`/`prohibition`/`duty`, `rdf:type`, `dct:title`, `dct:description`), which the Advanced Wizard and the modal detail read directly.

> The previous version of this plan added `openrel:simpleWho`, `openrel:simplePerm:<action>`, `openrel:simpleWhere`, `openrel:simpleWhen`, `openrel:geoInclude`/`geoExclude`, `openrel:simpleDateStart`/`End` to ~20 policy files. That work is **dropped** — superseded by the index (Decision 3). The reverse-option fallback (former §9) is also dropped, since the index makes it unnecessary.

### 5.3 Scenarios (`type_scenario.ttl`) — add 4W+why dimension annotation

Lightweight approach (Decision 2): no reparenting; add an annotation property so the adapter can group filter chips by dimension.

| Predicate | Value | Example |
|---|---|---|
| `openrel:dimension` | literal | `who` / `what` / `where` / `when` / `why` |

### 5.4 Constraints (`constraints.ttl`) — parameter linkage via existing system

Per Refinement 1, do **not** add `openrel:hasParam`/`openrel:paramType`. Instead, where a constraint uses a parameter, link it to the existing `openrel:Parameter` system. The adapter derives the wizard's parametric input fields entirely from the linked Parameter instance (see §6.4).

### 5.5 Action / constraint grouping alignment

The Advanced Wizard groups ~25 constraints into 8 accordion categories. `constraints.ttl` already has `openrel:constraintType`. Use a client-side lookup table (no source-data rename) to map `constraintType` values → the mock's category labels.

---

## 6. Work stream 4 — Adapter (client-side)

One thin module per source. Each fetches via `base44.functions.invoke('fetchApiSourceContent', { section, … })` (or a static file for the standalone build) and returns the *exact* shape the UI consumes today, so UI components are untouched.

### 6.1 Adapter registry (loaded at app init, parallel)

```js
const [index, actions, constraints, countries, parameters, bindings, scenarios] = await Promise.all([
  loadPolicyIndex(),    // discovery + simple preload
  loadActions(),
  loadConstraints(),
  loadCountries(),
  loadParameters(),
  loadParameterBindings(),
  loadScenarios(),
]);
```

### 6.2 `loadActions()` → `ACTIONS[]`

```
fetch({ section:"Actions", keep_properties:true })
→ { id, label, iri, cat: [openrel:actionCategory...], dd: openrel:defaultDuty || "postDuty" }
```

### 6.3 `loadConstraints()` → `CONSTRAINTS[]` (grouped)

```
fetch({ section:"Constraints", keep_properties:true })
→ group by openrel:constraintType (mapped via lookup table)
→ { id, label, iri, param, paramType, pname, placeholder, tooltip }
```

### 6.4 Parameter resolution (Refinement 1)

For each constraint linked to a Parameter, resolve the Parameter and decide UI behaviour from `resolutionMethod` (from `Parameter Bindings`):

| `resolutionMethod` | UI behaviour |
|---|---|
| `PolicyValue` | read-only literal, no input |
| `SuppliedParameterValue` | render the parametric input |
| `AssetMetadataValue` | pre-filled read-only, labelled "from asset metadata" |
| `PartyContext` / `RequestorContext` / `SubjectContext` | pre-filled read-only, labelled by source |
| `RepositoryContext` / `RuntimeContext` / others | read-only, labelled by source |

### 6.5 `loadCountries()` → `COUNTRIES[]`

```
fetch({ section:"Countries", keep_properties:true })
→ { label, iso, eu, flag, gn }
```

### 6.6 `loadScenarios()` → tag/topic axis

```
fetch({ section:"Scenarios", keep_properties:true })
→ { iri, label, dimension, broader }
```

### 6.7 `loadPolicyIndex()` → discovery list (NEW)

This is the **primary discovery path**, replacing the folder-mode list as the source of the browser grid.

```js
// framework-agnostic adapter (see public/odrel-wizard/lib/policyIndex.js)
const adapter = createPolicyIndexAdapter({ fetchIndex: () =>
  base44.functions.invoke('fetchApiSourceContent', { section: 'PolicyIndex' })
    .then(r => /* unwrap the JSON document */)
});
const cards = await adapter.listCards(actions);  // { id, label, desc, type, status, tags, isComposite, childCount, permits, prohibits, requires }
```

- **No TTL parse per card.** The index already carries curated perm/proh/duty action lists (resolved to labels via the actions vocab), status, tags, and composite children. The grid renders instantly.
- Action lists are **IRIs** (`openrel:read`, `openrel:attribute`, …), resolved to labels client-side — new actions need no index schema change (Decision 9).
- `simplePerm` / `simpleDuty` / optional `simpleProhibit` express the Simple Wizard's "What"; `q1`/`q3`/`q4`/`geoInc`/`geoExc`/`dateStart`/`dateEnd` are also curated in the index entry.

### 6.8 `loadTemplateDetail(iri)` → rules + constraints (TTL, unchanged)

The Advanced Wizard and the modal still fetch the **live TTL** for the full rule/constraint tree:

```
fetch({ section:"Policies", id, format:"ttl" })  // folder mode, raw TTL
→ parse via odrlParser (N3.js) → permission/prohibition/duty/constraint tree
```

### 6.9 `getPreload(iri)` → Simple Wizard preload (from index)

```js
const preload = await adapter.getPreload(iri);
// { iri, ptype, label, desc, simple: { q1, simplePerm[], simpleProhibit[], simpleDuty[], q3, geoInc[], geoExc[], q4, dateStart, dateEnd }, hasPolicy[] }
```

The Simple Wizard consumes this directly — pixel-identical to the mock, with no TTL inference.

### 6.10 Duplicate check (client-side, index-backed)

On entering a review step, compute the fingerprint of the live policy (mock's `fp()`/`simpleToCanonical()`) and match against the fingerprints in the index. No extra API call. The index's fingerprint field is the canonical source; at scale, an Elasticsearch query replaces it with no UI change.

### 6.11 Save (unchanged)

```js
base44.functions.invoke('jsonToTtl', {
  json_policy, github_target_folder: "data/policy", github_target_file: "<slug>.ttl",
  github_branch: "main", namespace: "openrel"
})
→ surface res.pr_url; the periodic indexer picks up the new TTL on its next run
```

### 6.12 Periodic indexer (NEW)

A scheduled backend function (or automation) rebuilds the index:

1. List all TTLs in `data/policy/` (folder mode).
2. Parse each with the shared N3 parser (reuse `odrlParser`).
3. **Auto-derive** structural fields: `iri`, `label`, `description`, `type`, `is_composite`, `hasPolicy`, perm/proh/duty action lists, `fingerprint`.
4. **Preserve** curated fields (`q1`, `simplePerm`/`simpleDuty`/`simpleProhibit`, `q3`, `geoInc`/`geoExc`, `q4`, `dates`, `tags`, `status`) from the existing index entry.
5. **Flag drift**: if a TTL's fingerprint ≠ stored fingerprint, mark the entry `needs_review` so the curator is alerted.
6. Write the merged JSON back to `data/input/policy_index.json` (via the GitHub write path).

This is the bridge to scale: today it regenerates a 20-entry JSON; tomorrow it writes to Elasticsearch. The adapter contract (`loadPolicyIndex`) does not change.

---

## 7. Migration order (shippable increments)

Each increment leaves the UI fully working.

| Step | Scope | Verifies |
|---|---|---|
| 1 | Data cleanups (§3) | adapter will not silently lose data |
| 2 | Register `Countries` section + `loadCountries()`; swap `COUNTRIES` const | end-to-end adapter pattern works |
| 3 | Register `Parameters` + `Parameter Bindings` sections; `loadParameters()`/`loadParameterBindings()` | parameter vocab loads |
| 4 | `actions.ttl` category additions + `loadActions()`; swap `ACTIONS` | Advanced palette grids populate |
| 5 | `constraints.ttl` parameter linkage + `loadConstraints()` (with §6.4 resolution); swap `CONSTRAINTS` | parametric inputs render via Parameter system |
| 6 | `type_scenario.ttl` dimension annotations + register `Scenarios` section + `loadScenarios()` | tag axis available |
| 7 | **Seed `policy_index.json` (20 entries) + register `PolicyIndex` section + `loadPolicyIndex()` adapter; swap `TEMPLATES` list + Simple Wizard preload** | Browser grid + Simple Wizard from real index |
| 8 | `loadTemplateDetail()` wired to folder-mode TTL for Advanced Wizard rules/constraints | Advanced preload from real library |
| 9 | Duplicate check (index fingerprints) + Save wiring | full flow end-to-end |
| 10 | Periodic indexer (§6.12) — auto-derive structural fields, preserve curated, flag drift | index stays in sync as policies are added |

---

## 8. What is explicitly NOT in this plan (deferred)

- Assertion-policy value resolution for parameters (the `resolutionMethod` → live binding path). The adapter is shaped for it; the UI rendering of pre-filled fields is the only future change.
- Policy-level parametric inputs in the UI (the adapter supports the data; no UI built yet).
- **Elasticsearch catalogue backend** — the `loadPolicyIndex()` adapter is the contract; swapping the fetcher to an ES query is a future backend change with no UI rework.
- Theme alignment (mock is light-mode; app is dark-mode) — separate UI decision.
- Reparenting the scenario taxonomy under 4W+why groups (lightweight annotation used instead).