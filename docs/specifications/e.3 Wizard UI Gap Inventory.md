# Annex E.3 — Policy Wizard UI Gap Inventory & Fix Plan

| Summary | Side-by-side gap inventory between the original Policy Wizard mock-up (`data/input/v0.4/OpenREL_Wizard_mock.html`, spec `e_ui_wizard.md`) and the refactored standalone wizard (`public/OpenREL_Wizard.html`), with source-of-truth rulings and a phased fix order |
| :---- | :---- |
| **Status** | Draft — pending Phase 0 decisions |
| **Version** | 0.1 |
| **Date** | 2026-09-01 |
| **Author** | OpenREL build agent |
| **Sources** | `docs/specifications/e_ui_wizard.md` (mock-up); `public/OpenREL_Wizard.html` (refactor) |

---

## 1. Purpose

This document is the single backlog for closing the gap between the refactored Policy Wizard and the original mock-up. Every discrepancy is logged once, here, with a category, severity, and source-of-truth ruling. No ad-hoc fixes are made outside this list.

## 2. Method & Source-of-Truth Policy

Each gap is tagged with a **source-of-truth** ruling:

| Ruling | Meaning |
| :---- | :---- |
| **MOCK** | Mock-up is canonical; the refactored UI must conform. |
| **REFACTOR** | Refactor is canonical (mock-up was aspirational/stale, or the refactor introduced a deliberate architecture improvement). Update the doc, leave the UI. |
| **DECISION** | Genuinely ambiguous; needs the owner's call before code. |

Default stance applied below: **MOCK** for layout, content copy, and wizard views/flows; **REFACTOR** for data sourcing and distribution; **DECISION** for theme and typography.

## 3. Gap Inventory

### 3.1 Missing functions (major — each is a real feature)

| ID | Gap | Severity | Source | Fix |
| :---- | :---- | :---- | :---- | :---- |
| F1 | **Simple Wizard view** (4 question steps + result step) | Blocker | MOCK | Build `#view-simple` with `sGoTo(n)` step panels `#sq1`–`#sq5` |
| F2 | **Advanced Wizard view** (7 sections + live preview) | Blocker | MOCK | Build `#view-advanced` two-column layout per §7 |
| F3 | **Mode switching** `switchMode(v)` (Simple↔Advanced, resets state) | Blocker | MOCK | Add wizard mode toggle in header; wire `switchMode` |
| F4 | **Template → Simple preload** `loadTplSimple(tpl)` | Major | MOCK | Replace card click-to-modal with explicit "Open in Simple" action |
| F5 | **Template → Advanced preload** `loadTplAdvanced(tpl)` | Major | MOCK | Add "Open in Advanced" action per card |
| F6 | **Fingerprint** `fp()` (djb2, order-independent) + template-match banner | Major | MOCK | Implement `fp()`; show on cards; `sFinish()` match banner |
| F7 | **`simpleToCanonical()`** mapping (q1–q4 + geo + dates → canonical policy) | Blocker | MOCK | Implement exact mapping per §9.4 |
| F8 | **`toODRL()`** JSON-LD serialization + live Advanced preview | Blocker | MOCK | Implement serializer; `renderAdvancedPreview()` on every AS change |
| F9 | **Output actions**: Copy JSON, Download JSON | Major | MOCK | Add Copy/Download buttons to result + preview |
| F10 | **Constraint picker** (25 constraints C01–C25, 7 categories, param prompts) | Blocker | MOCK | Build constraint catalogue UI + param inputs (URI/int/date/geo/duration) |
| F11 | **Action picker** (Action Catalogue multi-select) | Blocker | MOCK | Build action picker used by Perms/Prohs/Oblis sections |
| F12 | **Geo picker** (country inc/exc search lists + tag chips) | Major | MOCK | Build `toggleGeo`/`toggleGeoA` + inc/exc lists with `odrl:and` hint |
| F13 | **Slug auto-generation** + `https://openrel.eu/policy/{slug}` preview | Minor | MOCK | Implement slugify + live preview URL |
| F14 | **Policy metadata form** (title, slug, desc, issuer, status, asset, pid) | Major | MOCK | Build Advanced §2 metadata form |
| F15 | **Agents form** (assigner, assignee type/URI) | Major | MOCK | Build Advanced §7 agents form |
| F16 | **Perms/Prohs conflict flagging** (overlap detection) | Minor | MOCK | Flag overlapping action IDs in §3/§4 |

### 3.2 Layout differences

| ID | Gap | Severity | Source | Fix |
| :---- | :---- | :---- | :---- | :---- |
| L1 | **Left filter panel** in Template Browser (collapsible facets: type, status, tags) | Major | MOCK | Add facet panel left of card grid |
| L2 | **Three-view architecture** (browser/simple/advanced via `showView`) | Blocker | MOCK | Introduce view switch; refactor currently browser-only |
| L3 | **Per-card action buttons** ("Open in Simple" / "Open in Advanced") | Major | MOCK | Replace single click-to-modal with two explicit CTAs |
| L4 | **Advanced two-column** (numbered sidebar checklist + section cards + pinned preview) | Blocker | MOCK | Build with F2 |
| L5 | **Header chrome** (logo, breadcrumb, mode toggle, avatar) | Minor | MOCK | Rebuild header per §3.1 |

### 3.3 Content / design differences

| ID | Gap | Severity | Source | Fix |
| :---- | :---- | :---- | :---- | :---- |
| C1 | **Theme**: mock-up is light-mode navy; refactor is dark-mode blue | Major | REFACTOR | Keep dark theme (decided 2026-09-01) |
| C2 | **Typography**: mock-up DM Serif Display / DM Sans / DM Mono; refactor Inter / JetBrains Mono | Minor | REFACTOR | Keep Inter / JetBrains Mono (decided 2026-09-01) |
| C3 | **Card fields**: missing fingerprint badge + constraints summary; status badge style differs | Minor | MOCK | Add fingerprint badge + constraints summary; align status badge |
| C4 | **Badge colour semantics**: mock-up green=Permission, orange=Obligation, red=Prohibition, purple=Access; refactor teal/red/orange tags | Minor | MOCK | Adopt mock-up palette once C1 decided |
| C5 | **Preview modal content**: mock-up = rendered policy + JSON-LD + fingerprint; refactor = parsed rules + composite children + preload JSON | Major | MOCK | Align modal to rendered-policy + JSON-LD + fingerprint; keep composite tree as refactor addition |

### 3.4 Refactor-canonical keeps (do not revert)

| ID | Item | Rationale |
| :---- | :---- | :---- |
| R1 | **Policy Index + live TTL parse** as data source | Mock-up was no-backend; refactor is API-driven (merged PRs are source of truth) |
| R2 | **Composite policy reference tree** (load children) | Refactor addition not in mock-up; keep alongside C5 modal |
| R3 | **Standalone HTML distribution** (N3.js, apiProxy) | Core project goal; mock-up was single-file demo |
| R4 | **Parser tolerance** (missing `.`/unescaped quote normalization) | Necessary for live canonical TTLs; keep as safety net |

## 4. Phase 0 Decisions (resolved 2026-09-01)

1. **Theme (C1)**: **Keep the refactor's dark theme.** Mock-up light navy not adopted.
2. **Typography (C2)**: **Keep Inter / JetBrains Mono.** DM Serif / DM Sans / DM Mono not adopted.
3. **Fingerprint (F6)**: **Implement `fp()`** (djb2, order-independent) for card identity badges and the Simple-wizard template-match banner.

## 5. Execution Phases

Each phase is independently shippable. Phases 2–4 depend on Phase 0 decisions only for cosmetic alignment; the functional structure (views, flows) can proceed in parallel.

| Phase | Scope | Items | Risk |
| :---- | :---- | :---- | :---- |
| **0** | Decisions | C1, C2, F6 approach | — |
| **1** | Template Browser conformance (layout/content) | L1, L3, C3, C4, F6 (card fingerprint) | Low |
| **2** | Simple Wizard | F1, F7, F4, F12, F13, F9, F6 (match banner) | Medium |
| **3** | Advanced Wizard | F2, F8, F10, F11, F14, F15, F16, L4 | High |
| **4** | Shared: Preview modal, mode switch, header | C5, F3, L5, L2 (view wiring) | Medium |
| **5** | Polish & regression | Badge semantics, empty states, copy alignment | Low |

**Sequencing rule**: functional views (F1, F2, F7, F8) are built end-to-end one at a time (wiring + state + refresh), not stubbed in parallel.

## 6. Out of Scope

- Legacy KB User component reuse — wizard logic stays decoupled per project rule.
- Backend authoring/persistence beyond the existing Policy Index + TTL fetch (submit-PR flow is separate).
- Mock-up features explicitly marked stale in later spec revisions.