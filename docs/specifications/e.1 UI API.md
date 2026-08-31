# E.1 — UI ↔ API Specification: Policy Wizard

*Specification for converting the OpenREL Policy Wizard from hardcoded JSON data to data served by the OpenREL KB API.*

---

## 1. Context

The Policy Wizard (`OpenREL_Wizard_mock.html`) is a single-page application with three views:

- **Template Browser** — a searchable/filterable grid of 17 policy templates, with a detail modal.
- **Simple Wizard** — a 5-step guided flow (Who → What → Where → When → Review).
- **Advanced Wizard** — an 8-step ODRL-authoring flow (Type → Metadata → Permissions → Prohibitions → Obligations → Constraints → Agents → Review).

The mock currently embeds all of its data as hardcoded JavaScript `const` arrays. This document identifies every data dependency, specifies which KB API endpoint should serve it, and defines the content each endpoint must return so the wizard can render and function correctly.

The target API is the existing OpenREL KB API (`fetchApiSourceContent`), which serves RDF-parsed "sections" (Actions, Constraints, Policies, Mappings, …) from configured GitHub source files. The wizard will call these sections through the SDK (`base44.functions.invoke('fetchApiSourceContent', { … })`) or via the Swagger-defined REST endpoints.

---

## 2. Inventory of data dependencies currently hardcoded

| # | Data element | Mock symbol | Used by | Current shape |
|---|---|---|---|---|
| D1 | Actions | `ACTIONS` | Advanced wizard steps 3–5; both review tabs | `[{id, label, iri, cat[], dd?}]` — 14 items |
| D2 | Constraints | `CONSTRAINTS` | Advanced wizard step 6; template modal | `[{cat, items[{id, label, iri, param, paramType?, pname?, placeholder?}]}]` — 8 cats, 25 items |
| D3 | Countries | `COUNTRIES` | Geo pickers (simple Q3, advanced C13) | `[{label, iso, eu, flag, gn}]` — 30 items |
| D4 | Templates (list) | `TEMPLATES` (card fields) | Browser grid + filter chips | `[{id, type, icon, iconBg, title, desc, permits[], prohibits[], requires[], tags[], topics[]}]` |
| D5 | Templates (full preload) | `TEMPLATES[].preload` | "Use this template" action | `{q1, q2{}, q3, geoInc[], geoExc[], q4, ptype, perms[], prohs[], oblis{}, cons{}}` |
| D6 | Template prose | `TEMPLATES[].prose` | Modal "What this template does"; review prose | plain-language string |
| D7 | Constraint tooltips | `CON_TIPS` | Modal constraint rows | `{C01: "…", …}` |
| D8 | Parameter tooltips | `PARAM_TIPS` | Modal parameter rows | `{"Clearing house URI": "…", …}` |
| D9 | Policy index (fingerprint→templates) | `COLLISION_MAP`, `POLICY_INDEX`, `ADV_INDEX` | Duplicate check | fingerprint hash → `[{pid, slug, title}]` |
| D10 | Fingerprint engine | `fp()`, `simpleToCanonical()` | Duplicate check | client-side hashing function |

**Operations (write):**

| # | Operation | Mock function | Purpose |
|---|---|---|---|
| O1 | Save policy to KB | `doSave()` | Commit ODRL JSON → GitHub `openrel/policies/` via pipeline |
| O2 | Duplicate check | `checkDuplicate()` | Fingerprint live policy, match against index |

---

## 3. Mapping: which data goes to the API, what stays client-side

### 3.1 Served by the KB API (read)

| Wizard data | API section | Endpoint | Params | Returns |
|---|---|---|---|---|
| **D1 Actions** | `Actions` | `fetchApiSourceContent` (list) | `{ section:"Actions", format:"json", keep_properties:true }` | All actions; each with `{iri, label, definition}` **plus** category + default-duty properties (see §4.1) |
| **D1 Action categories** | `Actions` | (derived from D1 properties) | — | `cat: ["perm","proh","obli"]` derived from `openrel:actionCategory` values; `dd` from `openrel:defaultDuty` |
| **D2 Constraints** | `Constraints` | `fetchApiSourceContent` (list) | `{ section:"Constraints", format:"json", keep_properties:true }` | All constraints; each with `{iri, label, definition}` **plus** category + param metadata (see §4.2) |
| **D3 Countries** | `Countries` *(new section)* | `fetchApiSourceContent` (list) | `{ section:"Countries", format:"json" }` | `[{iri, label, definition}]` plus EU/ISO/flag/GeoNames properties (see §4.3) |
| **D4 Templates (list)** | `Policies` (folder mode) | `fetchApiSourceContent` (list) | `{ section:"Policies", format:"json" }` | `[{iri, label, definition}]` — the 20 policy files |
| **D5 Template preload** | `Policies` (folder mode) | `fetchApiSourceContent` (detail) | `{ section:"Policies", id:"openrel:CC0-1.0", format:"json", keep_properties:true }` | Full member with `properties[]` (see §4.4) |
| **D6 Template prose** | `Policies` | (derived from D5 `definition` or a `openrel:prose` property) | — | `definition` field serves as plain-language prose |
| **D7 Constraint tooltips** | `Constraints` | (derived from D2 `definition`) | — | `definition` = tooltip text |
| **D8 Parameter tooltips** | `Constraints` | (derived from D2 param metadata) | — | `openrel:paramDescription` property |
| **D9 Policy index** | `PolicyIndex` *(new section)* OR client-side from D4/D5 | `fetchApiSourceContent` (list) | `{ section:"PolicyIndex", format:"json" }` | `[{iri (fingerprint), label, matches[{pid, slug, title}]}]` (see §4.5) |

### 3.2 Computed client-side (no API call)

| Element | Why it stays local |
|---|---|
| **D10 Fingerprint engine** (`fp()`, `simpleToCanonical()`) | Pure functions over the wizard's own state; no external data needed. The canonical mapping (simple selections → `{type, perms, prohs, oblis, cons}`) is UI logic, not reference data. |
| Simple-mode prose generation (`buildSReview`) | Template-string composition from live state. |
| ODRL JSON-LD assembly (`buildSJSON`, `buildAJSON`) | Serialization of live state into the ODRL structure to be saved. |
| Filter/sort logic for the browser grid | Operates on the fetched template list. |
| Slug generation from title | Local string transformation. |

### 3.3 Write operations (API calls)

| Operation | Mechanism | Params | Returns |
|---|---|---|---|
| **O1 Save policy to KB** | Existing `jsonToTtl` backend function → `submitPolicyPR` | `{ json_policy: <ODRL JSON-LD>, target_folder, target_file, branch, namespace }` | `{ status, pr_url }` (PR created in GitHub) |
| **O2 Duplicate check** | `fetchApiSourceContent` on `PolicyIndex` section with `prefix` or by computing client-side against the fetched Policies list | `{ section:"PolicyIndex", prefix:<fingerprint> }` OR local `POLICY_INDEX.find(...)` | matched templates `[{pid, slug, title}]` |

---

## 4. Required API response content

Each subsection defines the exact fields the API must return for the wizard to function. Fields beyond the standard `{iri, label, definition}` must be present as parsed RDF properties (via `keep_properties=true`) and are listed with the predicate IRI the source file should declare.

### 4.1 Actions (`section: "Actions"`)

**List call** — `fetchApiSourceContent({ section:"Actions", format:"json", keep_properties:true })`

Each member:

```json
{
  "iri": "openrel:use",
  "label": "Use",
  "definition": "Use the resource for any purpose including computational processing.",
  "properties": [
    { "predicate": "openrel:actionCategory", "object": "perm", "is_literal": true },
    { "predicate": "openrel:actionCategory", "object": "proh",  "is_literal": true },
    { "predicate": "openrel:actionCategory", "object": "obli", "is_literal": true },
    { "predicate": "openrel:defaultDuty",    "object": "postDuty", "is_literal": true }
  ]
}
```

| Wizard field | Source | Notes |
|---|---|---|
| `id` (mock `A01`) | `openrel:actionId` property OR derived from list order | Stable short code for display; the IRI is the real identifier |
| `label` | `skos:prefLabel` / `dct:title` | Already returned by the API |
| `iri` | subject IRI | Already returned |
| `cat[]` (`perm`/`proh`/`obli`) | repeated `openrel:actionCategory` literals | Drives which grids the action appears in (Advanced steps 3/4/5) |
| `dd` (`preDuty`/`postDuty`) | `openrel:defaultDuty` literal | Default duty type when the action is selected as an obligation |

The client assembles `cat` by collecting all `openrel:actionCategory` values, and sets `dd` from the `openrel:defaultDuty` value (falls back to `postDuty`).

### 4.2 Constraints (`section: "Constraints"`)

**List call** — `fetchApiSourceContent({ section:"Constraints", format:"json", keep_properties:true })`

Each member:

```json
{
  "iri": "openrel:constraint.purpose:academicResearch",
  "label": "Academic Research",
  "definition": "Access is limited to academic research purposes only.",
  "properties": [
    { "predicate": "openrel:constraintCategory", "object": "Purpose", "is_literal": true },
    { "predicate": "openrel:hasParam",  "object": "false", "is_literal": true },
    { "predicate": "openrel:paramType", "object": "geo", "is_literal": true },
    { "predicate": "openrel:paramName", "object": "duration", "is_literal": true },
    { "predicate": "openrel:placeholder", "object": "e.g. PT24H", "is_literal": true },
    { "predicate": "openrel:paramDescription", "object": "The duration…", "is_literal": true }
  ]
}
```

| Wizard field | Source | Notes |
|---|---|---|
| `id` (mock `C01`) | `openrel:constraintId` OR list order | |
| `label` | `skos:prefLabel` / `dct:title` | |
| `iri` | subject IRI | |
| `cat` (category group) | `openrel:constraintCategory` literal | Groups items under collapsible headers (Advanced step 6) |
| `param` (bool) | `openrel:hasParam` literal ("true"/"false") | Whether a param input panel is shown |
| `paramType` | `openrel:paramType` literal (`geo`/`duration`/`daterange`/`integer`/`uri`) | Selects the input widget |
| `pname` | `openrel:paramName` literal | Input label |
| `placeholder` | `openrel:placeholder` literal | Input placeholder |
| tooltip (D7) | `definition` | Reused as the constraint info tooltip |
| param tooltip (D8) | `openrel:paramDescription` literal | Info tooltip next to the parameter input |

The client groups constraints by `openrel:constraintCategory` to rebuild the category-accordion structure.

### 4.3 Countries (`section: "Countries"` — new)

**List call** — `fetchApiSourceContent({ section:"Countries", format:"json", keep_properties:true })`

Each member:

```json
{
  "iri": "https://sws.geonames.org/2782113/",
  "label": "Austria",
  "definition": "",
  "properties": [
    { "predicate": "openrel:isoCode", "object": "AT", "is_literal": true },
    { "predicate": "openrel:isEU",    "object": "true", "is_literal": true },
    { "predicate": "openrel:flag",     "object": "🇦🇹", "is_literal": true }
  ]
}
```

| Wizard field | Source | Notes |
|---|---|---|
| `label` | `skos:prefLabel` / `dct:title` | Country name |
| `iso` | `openrel:isoCode` | ISO-3166 alpha-2 |
| `eu` | `openrel:isEU` ("true"/"false"/"null") | EU membership badge |
| `flag` | `openrel:flag` | Emoji flag |
| `gn` | subject IRI | GeoNames URI (used as `odrl:spatial` `@id` in ODRL output) |

*Alternative:* if a dedicated `Countries` source file is not desired, this can be served by an existing **VocabularySource** entity configured through the KB Manager (Vocabulary Manager page), since countries are a controlled reference list. The choice is a configuration decision, not a wizard requirement.

### 4.4 Templates / Policies (`section: "Policies"`, folder mode)

**List call (browser grid)** — `fetchApiSourceContent({ section:"Policies", format:"json" })`

```json
[
  { "iri": "openrel:CC0-1.0", "label": "Open Access — No Restrictions",
    "definition": "Anyone can read, download, share, and reuse this resource freely…" }
]
```

The browser grid additionally needs: `type` (Licence/Access/Process/Policy), `tags`, `topics`, and the permits/prohibits/requires summaries shown on each card. These must be available as properties, so the **list call should use `keep_properties=true`** OR the client fetches each detail lazily on card render. Recommended: keep the list lean and fetch detail on modal open.

| Wizard card field | Source | Predicate |
|---|---|---|
| `type` | `rdf:type` | `openrel:Licence` / `openrel:Access` / `openrel:Process` / `openrel:Policy` (strip `openrel:` prefix for the chip) |
| `tags[]` | `dct:subject` / `openrel:tag` | repeated literals |
| `topics[]` | `openrel:topic` | repeated literals (`open-access`, `non-commercial`, …) — drives the topic filter chips |
| `permits[]` (card summary) | `openrel:permits` | repeated action IRIs (labels resolved via D1) |
| `prohibits[]` (card summary) | `openrel:prohibits` | repeated action IRIs |
| `requires[]` (card summary) | `openrel:requires` | repeated action IRIs (obligations) |

**Detail call (preload)** — `fetchApiSourceContent({ section:"Policies", id:"openrel:CC0-1.0", format:"json", keep_properties:true })`

Returns the full member with all properties. The client maps them to the `preload` object:

| `preload` field | Source predicate(s) | Mapping |
|---|---|---|
| `ptype` | `rdf:type` | `openrel:Licence` → `"Licence"` |
| `q1` | `openrel:simpleWho` | `public`/`noncommercial`/`researchers`/`managed` |
| `q2.{read,share,modify,commercial,attribution,sharealike}` | `openrel:simplePerm:<action>` booleans | 6 boolean flags |
| `q3` | `openrel:simpleWhere` | `worldwide`/`restricted` |
| `geoInc[]` / `geoExc[]` | `openrel:geoInclude` / `openrel:geoExclude` | country ISO codes or GeoNames URIs |
| `q4` | `openrel:simpleWhen` | `unlimited`/`fixed` |
| `perms[]` | `odrl:permission` / `openrel:permits` | action IDs |
| `prohs[]` | `odrl:prohibition` / `openrel:prohibits` | action IDs |
| `oblis{}` | `openrel:obligation` with `openrel:dutyType` | keyed by action ID → `preDuty`/`postDuty` |
| `cons{}` | `openrel:constraint` refs | keyed by constraint ID; parametric values inline |
| `slug` | filename (folder mode) | already the member `iri` local name |
| `prose` | `dct:description` / `openrel:prose` | plain-language paragraph for modal + review |

*The exact predicate names are a modelling decision for the policy TTL files; the wizard only requires that the chosen predicates be consistently present so the client mapper can resolve them. The table above proposes a workable set.*

### 4.5 Policy Index / Duplicate lookup (`section: "PolicyIndex"` — new)

Two viable approaches:

**Option A — server-side index (recommended for scale):**
A dedicated source file `data/policy_index.ttl` (or generated) listing fingerprints and their template matches.

`fetchApiSourceContent({ section:"PolicyIndex", format:"json", keep_properties:true })`

```json
[
  {
    "iri": "fb781475",
    "label": "Open Access — No Restrictions",
    "properties": [
      { "predicate": "openrel:match", "object": "openrel:open-access-no-restrictions", "is_literal": false },
      { "predicate": "openrel:matchPid", "object": "p001", "is_literal": true }
    ]
  },
  {
    "iri": "2f2f60e9",
    "label": "Multiple matches",
    "properties": [
      { "predicate": "openrel:match", "object": "openrel:open-access-attribution", "is_literal": false },
      { "predicate": "openrel:matchPid", "object": "p002", "is_literal": true },
      { "predicate": "openrel:match", "object": "openrel:no-derivatives-read-only", "is_literal": false },
      { "predicate": "openrel:matchPid", "object": "p005", "is_literal": true }
    ]
  }
]
```

The client computes the fingerprint locally (D10 stays client-side) and looks up the member whose `iri` equals the fingerprint hash. This keeps the fingerprint algorithm in one place (the client) while the index data lives in GitHub and is editable without code changes.

**Option B — client-side index (simplest):**
Fetch the full Policies list (D4/D5), compute fingerprints for each on load, and build the collision map in memory. No new section needed. Acceptable while the template count is small (~20).

The `ADV_INDEX` (one fingerprint per template, Advanced mode) follows the same pattern — one fingerprint per policy member, derived from its preload structure.

### 4.6 Write: Save policy to KB (O1)

Reuse the existing **`jsonToTtl`** backend function, which converts an ODRL JSON-LD object to Turtle and (via `submitPolicyPR`) opens a GitHub pull request against the policies folder.

```js
base44.functions.invoke('jsonToTtl', {
  json_policy: <ODRL JSON-LD built by buildSJSON / buildAJSON>,
  github_target_folder: "data/policy",
  github_target_file: "<slug>.ttl",
  github_branch: "main",
  namespace: "openrel"
})
```

**Expected response:**

```json
{
  "status": "success",
  "pr_url": "https://github.com/wimhugo/openrel/pull/123",
  "message": "Policy TTL committed; PR opened for review."
}
```

The wizard surfaces `pr_url` in the "saved" confirmation. The `last_pr_url` field already exists on the `JsonPolicyParser` entity and can be used for status feedback.

---

## 5. Summary: call list

| # | View / step | Call | Purpose |
|---|---|---|---|
| 1 | App init | `fetchApiSourceContent({ section:"Actions", keep_properties:true })` | Load action palette |
| 2 | App init | `fetchApiSourceContent({ section:"Constraints", keep_properties:true })` | Load constraint palette + tooltips |
| 3 | App init | `fetchApiSourceContent({ section:"Countries", keep_properties:true })` | Load geo picker lists |
| 4 | Browser load | `fetchApiSourceContent({ section:"Policies" })` | Template grid (list, lean) |
| 5 | Card render / modal open | `fetchApiSourceContent({ section:"Policies", id:<iri>, keep_properties:true })` | Template detail + preload data |
| 6 | Review (simple & advanced) | `fetchApiSourceContent({ section:"PolicyIndex", keep_properties:true })` (or client-side) | Duplicate check |
| 7 | Save | `jsonToTtl({ json_policy, … })` | Commit ODRL → TTL → GitHub PR |

Calls 1–3 can be batched at app init (parallel). Call 4 on browser view mount. Call 5 lazy per card/modal. Call 6 on entering a review step. Call 7 on save click.

---

## 6. Open decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | Countries source | (a) new `Countries` ApiSourceFile section; (b) VocabularySource entity | (b) if already managed via Vocabulary Manager; (a) if it should live in the policy repo |
| 2 | Policy index | (a) server-side `PolicyIndex` section; (b) client-side from Policies list | (b) now (~20 templates); migrate to (a) when the list grows or fingerprints are computed server-side |
| 3 | Template "card summary" fields (type, tags, topics, permits/prohibits/requires) | (a) include in list response (`keep_properties=true` on list); (b) lazy detail per card | (a) for simplicity — the payload is small for ~20 files; revisit if it grows past ~50 |
| 4 | Predicate naming for wizard-specific metadata (`openrel:actionCategory`, `openrel:hasParam`, `openrel:simpleWho`, …) | to be fixed in the policy/action/constraint TTL source files | Adopt the predicates proposed in §4 and document them in the OpenREL vocabulary |
| 5 | Fingerprint algorithm ownership | (a) client-side only (current); (b) mirrored server-side for an index endpoint | Keep client-side; the index (data) is in GitHub, the algorithm (code) is in the UI |