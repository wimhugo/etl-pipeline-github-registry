# E.2 — UI ↔ API Migration Plan: Policy Wizard

*Consolidated plan for converting the OpenREL Policy Wizard from hardcoded JSON to data served by the OpenREL KB API, incorporating the gap analysis and the two refinements (parameter system reuse; scenario-based tags).*

---

## 1. Context and scope

This plan supersedes the open-decisions table in `e.1 UI API.md` by resolving each one against the *current* content of the OpenREL vocab and policy files. It assumes:

- The `fetchApiSourceContent` backend function already works (file + folder mode) and parses TTL/JSON/JSON-LD/YAML.
- The `jsonToTtl` → `submitPolicyPR` write path already works.
- The wizard mock (`data/input/v0.4/OpenREL_Wizard_mock.html`) is the functional baseline; the goal is to preserve its behaviour while sourcing data from the API.

The plan covers four work streams, executed in order:

1. **Data cleanups** — fix TTL syntax errors in vocab files the adapter will depend on.
2. **New API sections** — register `ApiSourceFile` entries for vocabularies the wizard needs.
3. **Property additions** — enrich existing source files with the minimal predicates the adapter requires.
4. **Adapter** — a client-side module per source that fetches from the API and returns the exact shape the UI consumes.

---

## 2. Decisions taken

| # | Decision (from gap analysis) | Choice | Rationale |
|---|---|---|---|
| 1 | Advanced Wizard port | **Option B** — read real `data/policy/` ODRL, near-zero UI change | Real policies are already ODRL; only action-category metadata is missing |
| 2 | Browser tags/topics | **Hybrid** — reuse `dct:subject` + `type_scenario.ttl`; add `openrel:policyStatus` | Avoids inventing `openrel:topic`; scenarios already exist and constraints already link to them |
| 3 | Simple Wizard port | **Option B-faithful** — add simple-mode predicates to policy TTLs | Preserves the 4-question UX exactly; reverse-option is recorded as a fallback (§9) |
| 4 | Constraint parameters | **Reuse existing `openrel:Parameter` system** — do NOT invent `openrel:hasParam`/`openrel:paramType` | The Parameter + ParameterBindingSource vocabularies already model this richer than the mock, and are future-proof for Assertion-policy binding |
| 5 | Policy index / dup check | **Client-side** (Option B from e.1 §4.5) | ~20 templates; no new endpoint needed |
| 6 | Save | Reuse `jsonToTtl` → `submitPolicyPR` | Already implemented |
| 7 | Countries source | New `Countries` ApiSourceFile section | Data file already exists with the right predicates |

---

## 3. Work stream 1 — Data cleanups (prerequisite)

The wizard adapter will silently lose data if these files are not fixed first. The TTL parser is tolerant but cannot recover missing statement terminators or wrong prefixes.

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

| Section | file_path | source_mode | member_identifier / notes | Wizard use |
|---|---|---|---|---|
| **Countries** | `data/input/countries.ttl` | file | `skos:Concept` (or whatever the file declares) | Simple Q3 / Advanced geo pickers |
| **Parameters** | `.openrel/vocabs/openrel/parameters.ttl` | file | `openrel:Parameter` | Constraint parametric inputs (refinement 1) |
| **Parameter Bindings** | `.openrel/vocabs/openrel/type_parameter_binding.ttl` | file | `openrel:ParameterBindingSource` | Decide whether a param renders an input, is pre-filled, or is read-only |
| **Scenarios** | `.openrel/vocabs/openrel/type_scenario.ttl` | file | `skos:Concept` | Browser tag/topic axis (refinement 2) |
| **Policies** | `data/policy/` | **folder** | `id_prefix: "openrel:"`, `title_field: dct:title`, `description_field: dct:description` | Template browser + detail/preload |

> Note: `Actions` and `Constraints` sections already exist; verify their `member_identifier` is correct for the current file content.

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

### 5.2 Policies (`data/policy/*.ttl`) — browser card + simple-mode preload

#### 5.2.1 Browser card fields

| Predicate | Value | Used by |
|---|---|---|
| `openrel:policyStatus` | literal `draft`/`review`/`active` | Status badge |
| `dct:subject` | repeated → `openrel:<scenario>` IRI | Tags/topics (union with constraint-derived scenarios) |

The card's permits/prohibits/requires summaries and the type badge are derived from `odrl:permission`/`prohibition`/`duty` and `rdf:type` — already present.

#### 5.2.2 Simple-mode preload (Decision 3: Option B-faithful)

These predicates reconstruct the Simple Wizard's `preload` object 1:1. Add per policy:

| `preload` field | Predicate(s) | Mapping |
|---|---|---|
| `ptype` | `rdf:type` | strip `openrel:` prefix |
| `q1` (Who) | `openrel:simpleWho` | `public`/`noncommercial`/`researchers`/`managed` |
| `q2.{share,modify,commercial,read,reproduce,attribution,sharealike}` | `openrel:simplePerm:<action>` | boolean literals |
| `q3` (Where) | `openrel:simpleWhere` | `worldwide`/`restricted` |
| `geoInc[]` / `geoExc[]` | `openrel:geoInclude` / `openrel:geoExclude` | ISO codes or GeoNames URIs |
| `q4` (When) | `openrel:simpleWhen` | `unlimited`/`fixed` |
| `dateStart` / `dateEnd` | `openrel:simpleDateStart` / `openrel:simpleDateEnd` | xsd:dateTime |
| `prose` | `dct:description` (already present) | modal + review prose |

Cost: ~8 predicates × 20 files. This is the largest single addition; it is the price of keeping the Simple Wizard pixel-identical. If the reverse-option is later chosen (§9), these are dropped and the Simple Wizard is rewritten to infer from ODRL instead.

### 5.3 Scenarios (`type_scenario.ttl`) — add 4W+why dimension annotation

Lightweight approach (Decision 2): no reparenting; add an annotation property so the adapter can group filter chips by dimension.

| Predicate | Value | Example |
|---|---|---|
| `openrel:dimension` | literal | `who` / `what` / `where` / `when` / `why` |

Add to existing scenario concepts where they map cleanly:
- `confirmed-researcher`, `affirmed-research`, `confirmed-rpo` → `who`
- `non-commercial-only`, `commercial-use`, `attribution`, `licence-preserved` → `what`
- (new or existing geo scenarios) → `where`
- `status-revoked`, embargo scenarios → `when`
- `gdpr-compliance`, `ethics-approval`, `explicit-consent`, `consent-gdpr` → `why`

Optionally extend the scheme with intermediate `openrel:dim-who` … `openrel:dim-why` concepts if a formal hierarchy is preferred later.

### 5.4 Constraints (`constraints.ttl`) — parameter linkage via existing system

Per Refinement 1, do **not** add `openrel:hasParam`/`openrel:paramType`. Instead, where a constraint uses a parameter, link it:

| Predicate | Value | Used by |
|---|---|---|
| `odrl:rightOperand` (or `openrel:hasParameter`) | → `openrel:Parameter` IRI | adapter walks `parameterName`/`expectedDatatype`/`resolutionMethod`/`skos:definition` |

The adapter derives the wizard's parametric input fields entirely from the linked Parameter instance (see §6.4). This keeps the binding model consistent and leaves the path open for Assertion-policy value resolution later.

### 5.5 Action / constraint grouping alignment

The Advanced Wizard groups ~25 constraints into 8 accordion categories. `constraints.ttl` already has `openrel:constraintType` (purpose/role/context/notification…). **One-time alignment decision:** either rename `openrel:constraintType` values to match the mock's 8 categories, or update the adapter to map `constraintType` values → the mock's category labels via a small lookup table. Recommend the lookup table (no source-data rename) to avoid touching constraint IRIs.

---

## 6. Work stream 4 — Adapter (client-side)

One thin module per source. Each fetches via `base44.functions.invoke('fetchApiSourceContent', { section, … })` and returns the *exact* shape the UI consumes today, so UI components are untouched.

### 6.1 Adapter registry (loaded at app init, parallel)

```js
const [actions, constraints, countries, parameters, bindings, scenarios] = await Promise.all([
  loadActions(),
  loadConstraints(),
  loadCountries(),
  loadParameters(),
  loadParameterBindings(),
  loadScenarios(),
]);
const templates = await loadTemplates(); // browser view mount
```

### 6.2 `loadActions()` → `ACTIONS[]`

```
fetch({ section:"Actions", keep_properties:true })
→ map each member:
   { id: <short code from openrel:actionId or list index>,
     label, iri,
     cat: collect all openrel:actionCategory literals,
     dd: openrel:defaultDuty || "postDuty" }
```

### 6.3 `loadConstraints()` → `CONSTRAINTS[]` (grouped)

```
fetch({ section:"Constraints", keep_properties:true })
→ group by openrel:constraintType (mapped via lookup table to mock categories)
→ per item:
   { id, label, iri,
     param: <bool, true if linked to an openrel:Parameter>,
     paramType: <derived from Parameter.expectedDatatype>,
     pname: Parameter.parameterName,
     placeholder: Parameter.parameterName (or derived),
     tooltip: member.definition }
```

### 6.4 Parameter resolution (Refinement 1) — the key new logic

For each constraint linked to a Parameter, resolve the Parameter from the `Parameters` section and decide UI behaviour from `resolutionMethod` (from `Parameter Bindings` section):

| `resolutionMethod` | UI behaviour |
|---|---|
| `PolicyValue` | read-only literal, no input |
| `SuppliedParameterValue` | render the parametric input (the mock's field) |
| `AssetMetadataValue` | pre-filled read-only, labelled "from asset metadata" |
| `PartyContext` / `RequestorContext` / `SubjectContext` | pre-filled read-only, labelled "from profile/assignee/data subject" |
| `RepositoryContext` / `RuntimeContext` / others | read-only, labelled by source |

> Future Assertion-policy binding: when `resolutionMethod` values become live bindings, the adapter already exposes them; only the UI rendering of "pre-filled" fields changes from placeholder to live value. No adapter contract change.

**Policy-level parameters** (e.g. target asset) are handled by the same mechanism at the policy member level — the adapter checks the policy's own parameter links, not only constraints'. The mock has no policy-level param input today; the adapter is written to surface one if present, so the capability is available without rework.

### 6.5 `loadCountries()` → `COUNTRIES[]`

```
fetch({ section:"Countries", keep_properties:true })
→ { label, iso: openrel:isoCode, eu: openrel:isEU, flag: openrel:flag, gn: iri }
```

### 6.6 `loadScenarios()` → tag/topic axis

```
fetch({ section:"Scenarios", keep_properties:true })
→ index by IRI: { iri, label, dimension: openrel:dimension, broader }
```

### 6.7 `loadTemplates()` → `TEMPLATES[]` (list, lean)

```
fetch({ section:"Policies" })  // folder mode, list view
→ per member:
   { id: iri (local name), label, desc: definition,
     type: strip "openrel:" from rdf:type,
     status: openrel:policyStatus,
     tags: union(dct:subject IRIs → scenario labels,
                 constraint-derived scenarios via cons links),
     topics: same set grouped by openrel:dimension,
     perms/prohs/cons: resolved from odrl:permission/prohibition/duty + constraints,
     fingerprint: computed client-side }
```

### 6.8 `loadTemplateDetail(iri)` → `preload` object

```
fetch({ section:"Policies", id, keep_properties:true })
→ map properties to preload (§5.2.2 table)
```

### 6.9 Duplicate check (client-side)

On entering a review step, compute the fingerprint of the live policy (mock's `fp()`/`simpleToCanonical()` — unchanged) and match against the fetched templates' fingerprints. No API call. Migrate to a `PolicyIndex` section only when the template count grows past ~50.

### 6.10 Save (unchanged)

```js
base44.functions.invoke('jsonToTtl', {
  json_policy: <ODRL JSON-LD>,
  github_target_folder: "data/policy",
  github_target_file: "<slug>.ttl",
  github_branch: "main",
  namespace: "openrel"
})
→ surface res.pr_url in the saved confirmation
```

---

## 7. Migration order (shippable increments)

Each increment leaves the UI fully working. The adapter is introduced first as a parallel path; the hardcoded constants are only removed once the adapter for that source is verified.

| Step | Scope | Verifies |
|---|---|---|
| 1 | Data cleanups (§3) | adapter will not silently lose data |
| 2 | Register `Countries` section + `loadCountries()` adapter; swap `COUNTRIES` const | end-to-end adapter pattern works |
| 3 | Register `Parameters` + `Parameter Bindings` sections; `loadParameters()`/`loadParameterBindings()` | parameter vocab loads |
| 4 | `actions.ttl` category additions + `loadActions()` adapter; swap `ACTIONS` | Advanced palette grids populate |
| 5 | `constraints.ttl` parameter linkage + `loadConstraints()` adapter (with §6.4 resolution); swap `CONSTRAINTS` | parametric inputs render via Parameter system |
| 6 | `type_scenario.ttl` dimension annotations + register `Scenarios` section + `loadScenarios()` | tag axis available |
| 7 | Policy property additions (§5.2) + `loadTemplates()`/`loadTemplateDetail()`; swap `TEMPLATES` + `preload` | Browser + Simple + Advanced preload from real library |
| 8 | Duplicate check + Save wiring | full flow end-to-end |

---

## 8. What is explicitly NOT in this plan (deferred)

- Assertion-policy value resolution for parameters (the `resolutionMethod` → live binding path). The adapter is shaped for it; the UI rendering of pre-filled fields is the only future change.
- Policy-level parametric inputs in the UI (the adapter supports the data; no UI built yet).
- A server-side `PolicyIndex` section (client-side suffices at current scale).
- Theme alignment (mock is light-mode; app is dark-mode) — separate UI decision.
- Reparenting the scenario taxonomy under 4W+why groups (lightweight annotation used instead).

---

## 9. Fallback: reverse-option for the Simple Wizard

If, after Step 7, the simple-mode predicate additions prove too costly to maintain across 20+ policy files, the fallback is to **rewrite View 2 (Simple Wizard)** to infer q1–q4 from the real ODRL:

| Simple field | Inferred from |
|---|---|
| q1 (Who) | constraints (`openrel:verifiedResearcher`, `openrel:nonCommercial`) + `openrel:accessType` |
| q2 (What) | action presence in `odrl:permission`/`prohibition` (distribute, modify, use) |
| q3 (Where) | `openrel:jurisdiction` + `odrl:spatial` constraints |
| q4 (When) | `openrel:validityType` + `odrl:dateTime` constraints |

Trade-off: no new predicates, but the Simple Wizard becomes approximate (some templates won't round-trip cleanly) and "who" has no clean ODRL source. This is a product decision, not a data decision; it is recorded here so the choice can be revisited without re-deriving the analysis.