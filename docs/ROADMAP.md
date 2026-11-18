# StockFlow Phase 7 Roadmap

Statuses use only **Planned**, **In Progress**, **Implemented**,
**Locally Validated**, and **Committed**. “Done” is intentionally not used:
phase-level acceptance has not been fully established. A committed issue does
not imply that its containing phase is complete.

## Phase Summary

| Phase | Scope | Dependency | Acceptance criteria | Actual status |
| --- | --- | --- | --- | --- |
| 7.0 — Repository & Worktree Reconciliation | Establish branch, HEAD, remote, and worktree baseline; preserve unrelated local work. | Initial prerequisite | Branch and remote baseline are known; no unrelated work is overwritten; worktree state is recorded. | Locally Validated — clean `main` matched `origin/main` at audit start. |
| 7.1 — Dependencies & Database Baseline | Review dependency manifests/lockfiles and establish a safe, repeatable database baseline. | 7.0 | Dependency state and database baseline are verified without data reset or unintended schema/data changes. | In Progress — SF-03 runner and its fresh-volume checks are committed; broader phase acceptance is not evidenced. |
| 7.2 — Full Local Quality Gate | Establish the local test, typecheck, lint, formatting, and coverage baseline. | 7.1 | Required local quality commands pass and measured coverage is recorded. | Locally Validated — historical baseline recorded in [VALIDATION_LOG.md](./VALIDATION_LOG.md); not rerun for this ledger. |
| 7.3 — P1 Runtime & Business Risks | Resolve high-impact runtime, data, and business-rule risks. | 7.1 and 7.2 | Each approved P1 scope has verified acceptance evidence; unresolved work remains visible. | In Progress — known SF-01, SF-03, SF-04, and SF-05 work is committed; SF-06 is committed, but its exact phase allocation and complete phase closure are not verified. |
| 7.4 — Integration & Frontend Workflow Coverage | Verify inventory issue/adjustment/reorder-level UI flows, full order draft-to-cancellation UI lifecycle, SF-08 paginated dropdown options, and a full-stack E2E smoke workflow. | 7.2; SF-07 ledger review gates the next action | Inventory and orders workflows are verified, then a role-appropriate UI/API/database smoke workflow passes. | In Progress — SF-08 is committed early as 7.4.3; 7.4.1, 7.4.2, and 7.4.4 remain unverified/not started. |
| 7.5 — Accessibility, Error States & Master Data Lifecycle | Close modal focus/Escape gaps, define consistent inactive-resource lifecycle, surface stale-data errors, decide category deactivation policy, and perform final docs/frontend cleanup. | 7.2; relevant master-data/API behavior and required business decisions | Accessible focus and Escape behavior, explicit stale-data errors, approved category/resource lifecycle rules, and verified cleanup meet their issue acceptance criteria. | In Progress — SF-01 and SF-02 are committed; modal/lifecycle/documentation work is partial, while SF-12 and SF-13 remain open. No evidence establishes full phase completion. |
| 7.6 — Final Hardening & CI Closeout | Final risk review, regression gate, and CI/deployment closeout. | 7.2–7.5 | Final local/CI gates and deployment documentation are verified; no unresolved release blocker remains. | Planned — no closeout evidence is recorded. |

## Confirmed Subphase Status

| Subphase/work item | Scope and acceptance | Dependency | Actual status |
| --- | --- | --- | --- |
| SF-01 — Reversible Product Lifecycle | Deactivation/reactivation, inactive-product restrictions, inventory visibility, stock clearance, order rules, and serialized stock operations match the approved business rules. | Product/inventory/order baseline. | **Committed** — `827827bd374bd40f112718007446b8c159c1d9e2`. Exact numbered Phase 7 subphase allocation was not found in the audit evidence. |
| SF-02 — Category Detail & Product Filtering | Category detail shows members; `categoryId` filtering, pagination, count, not-found behavior, and API docs agree. | Existing categories/products API. | **Committed** — `2c6f8f1a0f6c20f5fa1d2d9820dd5b5a56f46368`. Exact numbered Phase 7 subphase allocation was not found in the audit evidence. |
| SF-03 — Database Migration Runner | Versioned, transactional, idempotent migrations with advisory locking; safe fresh/existing database behavior. | Existing migrations and database baseline. | **Committed** — `263cdec87210b2b8f84db77bd26dd5e5e04d6f6e`; explicitly identified as Phase 7.3.4. |
| SF-04 — Authentication Session Recovery | Startup preserves a refreshable session, restores authenticated state after refresh, and preserves session on transient failures. | Existing auth/session contract. | **Committed** — `934ac09c9857be11bc21c604f76389b79fdd3527`; explicitly identified as Phase 7.3.2. |
| SF-05 — API Refresh/Retry Error Propagation | Refresh/retry failures preserve actual network/server errors, deduplicate concurrent refresh, and avoid loops. | SF-04. | **Committed** — `fb732544a98adb8bf3f8b1f697e954e5dc63fcf7`; explicitly identified as Phase 7.3.3. |
| SF-06 — OpenAPI Parity | Document authentication request/response/security/error contracts from actual routes and controller behavior; add contract tests. | Implemented API behavior. | **Committed** — `960372bff0ca76a3cc09df7fd949e045f35e9f11`; exact numbered Phase 7 subphase allocation was not verified. |
| SF-07 — Project Progress Ledger | Maintain evidence-based status, roadmap, known-issue, and validation documents without changing runtime behavior. | Repository/history/recovery audit. | **In Progress** — this documentation change is uncommitted and awaiting review. |
| 7.4.1 — Inventory UI Workflow Testing (SF-10) | Verify inventory issue, adjustment, and reorder-level UI workflows, including success and error states. | 7.2 and SF-07 review. | **Planned** — targeted operation tests exist, but complete workflow coverage is not verified. |
| 7.4.2 — Orders UI Workflow Testing (SF-10) | Verify order draft creation, editing, confirmation, and cancellation through the UI, including expected stock effects. | 7.2 and 7.4.1 sequencing. | **Planned** — page-level lifecycle coverage is not verified. |
| 7.4.3 — SF-08 Dropdown Option Fetching | Reach API-backed options past the first 100 while preserving search, pagination, selected values, and retry behavior. | Existing paginated APIs. | **Committed** — `297551bbbe33a9a32782c101549f9e2790350d24`. This early completion does not complete 7.4.1 or 7.4.2. |
| 7.4.4 — Full-stack E2E Smoke Workflow (SF-10) | Exercise a role-appropriate login, draft, confirmation, stock movement, and cancellation/restoration flow across UI, API, and database. | 7.4.1 and 7.4.2. | **Planned** — not started; the existing setup smoke tests only check test DB isolation and API health. |
| SF-09 — Master-Data Lifecycle (7.5.2) | Provide consistent inactive discovery/reactivation per resource; resolve remaining warehouse/category lifecycle gaps. Product lifecycle is already resolved by SF-01. | SF-01; resource-specific lifecycle rules. | **In Progress** — product scope committed; warehouse/category flows remain open. |
| SF-10 — Operational Frontend Workflow Tests (7.4.1, 7.4.2, 7.4.4) | Complete inventory and order UI mutation coverage and a full-stack E2E smoke flow. | 7.2; 7.4.1 precedes 7.4.2 and 7.4.4. | **In Progress** — SF-08/7.4.3 is committed; remaining subphases are open. |
| SF-11 — Modal Lifecycle and Accessibility (7.5.1) | Standardize modal focus boundary/restoration, Escape policy during mutations, accessible background behavior, and keyboard tests. | Shared modal foundation and 7.2. | **In Progress** — shared modal work is present; focus-escape and pending-Escape gaps remain. |
| SF-12 — Stale-Data Error Visibility (7.5.3) | Distinguish initial and refetch errors and clearly label retained stale list data. | 7.2; list-query review. | **Planned** — issue remains in current list pages. |
| SF-13 — Category Deactivation Policy (7.5.4) | Decide and test the behavior for active products in a category being deactivated, without assuming cascading changes. | SF-09 category lifecycle decision. | **Planned** — requires an explicit business decision. |
| SF-14 — Documentation and Frontend Cleanup (7.5.5) | Complete README/auth guidance, frontend metadata, and evidence-based asset/comment/test-setup cleanup. | Final hardening; verify all references before removal. | **In Progress** — some project/setup documentation exists; remaining audit items are open. |

## Phase Allocation Notes

- Explicitly verified numbered mappings are SF-04 = 7.3.2, SF-05 = 7.3.3,
  SF-03 = 7.3.4, and SF-08 = 7.4.3. The audit maps SF-09 and SF-11–SF-14
  into Phase 7.5, and SF-10 into 7.4.1, 7.4.2, and 7.4.4.
- The repository/audit evidence confirms SF-01, SF-02, and SF-06 are
  committed, but does not establish their exact numbered subphase allocation.
- SF-09 through SF-14 scope and priorities are recorded from the 17 November
  2026 Source Audit & Recovery Plan, Section 5; see [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)
  for initial evidence and the separately verified current implementation
  status. Their mapping does not imply they are complete.
- The next action after SF-07 review/completion is 7.4.1, not 7.4.4. Phase 7.4
  remains incomplete while 7.4.1 and 7.4.2 are unverified.
- Phase 7.5 also remains incomplete: SF-11 has unresolved focus/Escape gaps,
  SF-12 and SF-13 are open, and SF-09/SF-14 have outstanding work.
