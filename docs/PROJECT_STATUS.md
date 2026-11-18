# StockFlow Project Status

## Overview

StockFlow is a warehouse and inventory management application with a REST API,
PostgreSQL persistence, authentication and authorization, product and category
master data, orders, stock movements, and a React frontend.

The repository is continuing its Phase 7 reliability and workflow-hardening
roadmap. SF-01 through SF-06 and SF-08 have commits on `main`. SF-07 is the
active documentation task. The 17 November 2026 Source Audit & Recovery Plan,
Section 5, provides scope for SF-09 through SF-14; their current evidence and
remaining acceptance work are recorded in [KNOWN_ISSUES.md](./KNOWN_ISSUES.md).
Inventory/order workflow testing and full-stack E2E remain unverified, and
Phase 7.5 accessibility, stale-data, category-policy, and cleanup work is
still outstanding.

## Repository Baseline

- Branch: `main`
- Baseline HEAD: `297551bbbe33a9a32782c101549f9e2790350d24`
  (`feat(ui): support paginated dropdown options`)
- At audit start, `main` matched `origin/main` and the working tree was clean.
- This SF-07 documentation work is uncommitted. The current worktree contains
  four untracked ledger documents: `PROJECT_STATUS.md`, `ROADMAP.md`,
  `KNOWN_ISSUES.md`, and `VALIDATION_LOG.md`. This correction updates only the
  first three; [DECISIONS.md](./DECISIONS.md) and
  [VALIDATION_LOG.md](./VALIDATION_LOG.md) remain unchanged.

## Completed Subphases

| Work item | Status | Full commit SHA | Git subject |
| --- | --- | --- | --- |
| SF-01 — Reversible Product Lifecycle | Committed | `827827bd374bd40f112718007446b8c159c1d9e2` | `feat(products): implement reversible product lifecycle` |
| SF-02 — Category Detail & Product Filtering | Committed | `2c6f8f1a0f6c20f5fa1d2d9820dd5b5a56f46368` | `feat(categories): add category detail and product filtering` |
| SF-03 — Database Migration Runner | Committed | `263cdec87210b2b8f84db77bd26dd5e5e04d6f6e` | `feat(db): add versioned migration runner` |
| SF-04 — Authentication Session Recovery | Committed | `934ac09c9857be11bc21c604f76389b79fdd3527` | `fix(auth): restore sessions after access token expiry` |
| SF-05 — API Refresh/Retry Error Propagation | Committed | `fb732544a98adb8bf3f8b1f697e954e5dc63fcf7` | `test(auth): cover refresh and retry error propagation` |
| SF-06 — OpenAPI Parity | Committed | `960372bff0ca76a3cc09df7fd949e045f35e9f11` | `docs(api): align OpenAPI authentication contracts` |
| SF-08 — Dropdown Option Fetching Limit | Committed | `297551bbbe33a9a32782c101549f9e2790350d24` | `feat(ui): support paginated dropdown options` |

The full SHAs and subjects above were resolved from Git history. SF-07 is
**In Progress** and has no commit yet. SF-09 through SF-14 have audit-backed
scopes and priorities now recorded; their status ranges from partial progress
to planned, and none is represented as fully complete.

## Active Phase and Next Action

- Active work: **SF-07 — Project Progress Ledger (In Progress)**.
- Next action after SF-07 review and completion: **Phase 7.4.1 — Inventory UI
  Workflow Testing**.
- Phase 7.4.2 — Orders UI Workflow Testing is also not verified complete.
- SF-08 is Phase 7.4.3 and is committed, but that does not complete Phase 7.4.
- Phase 7.4.4 — Full-stack E2E Smoke Workflow has not started.

See [ROADMAP.md](./ROADMAP.md) for phase dependencies and acceptance criteria,
and [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) for the SF-01–SF-14 register.

## Outstanding Blockers and Risks

- **SF-09 (P2):** SF-01 resolved product lifecycle, but warehouse inactive
  discovery/reactivation UI and category lifecycle remain outstanding.
- **SF-10 (P2):** Inventory and order UI workflow tests and a full-stack E2E
  smoke workflow have not been verified complete. SF-08 only closes dropdown
  option fetching (7.4.3).
- **SF-11 (P2):** Shared modal work exists, but programmatic focus escape and
  Escape during pending mutations remain unresolved.
- **SF-12 (P2):** Several paginated list pages can hide a refetch failure while
  prior data remains visible.
- **SF-13 (P2):** Category deactivation behavior for active products requires
  an explicit business decision; no cascade rule is assumed.
- **SF-14 (P3):** README/auth guidance, frontend template/metadata, and
  evidence-based cleanup remain outstanding; the migration-runner duplication
  finding must be rechecked before action.
- Phase 7.4 remains incomplete (7.4.1, 7.4.2, and 7.4.4 open); Phase 7.5 also
  remains incomplete. See [ROADMAP.md](./ROADMAP.md) for mappings and
  dependencies.
- Phase 7.2 test and coverage figures are a historical baseline, not evidence
  of a current full regression run.
- SF-08 product options use server-side search where supported. Customer,
  warehouse, and category option APIs do not expose server-side search in the
  audited contract; those choices are reached through pagination.
- `README.md` contains a broad status statement about CI completion, but the
  Phase 7.6 final-hardening and CI-closeout acceptance has not been verified
  by this audit. README was not changed.

## Last-Known-Green Validation

The latest recorded feature validation is SF-08's targeted frontend run:
Vitest reported **8 test files passed and 61 tests passed**; frontend
TypeScript, file-scoped ESLint, Prettier, and `git diff --check` passed.
The test command supplied nine file paths, while Vitest reported eight test
files; the available output does not explain the difference. This was a
targeted validation, not a full regression run. See
[VALIDATION_LOG.md](./VALIDATION_LOG.md) for the historical results and
limitations.
