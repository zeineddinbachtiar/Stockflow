# StockFlow Validation Log

This is a historical ledger. Unless specifically called out as a current
documentation check, entries below describe prior executions and were not
rerun for SF-07. Commands, dates, and environments are omitted where the
available evidence does not establish them. “Pass” reflects the recorded
result, not a claim that the full suite is currently green.

## Phase 7.2 — Full Local Quality Gate Baseline

- **Status:** Historical baseline.
- Backend tests: **118 passed**.
- Frontend tests: **187 passed**.
- Coverage: statements **78.22%**, branches **78.73%**, functions
  **74.49%**, lines **80.51%**.
- **Evidence limitation:** These figures were supplied as the baseline
  cross-reference; detailed command output and execution environment are not
  present in this audit. They were not rerun.

## SF-01 — Reversible Product Lifecycle

- **Commit:** `827827bd374bd40f112718007446b8c159c1d9e2`.
- Lifecycle integration tests: **5/5 passed**.
- Master-data, inventory, and order integration tests: **70 tests passed**.
- Targeted frontend tests: **34/34 passed**.
- Backend and frontend type checks: **passed**.
- **Evidence classification:** Historical validation result from the prior
  task record; not rerun for SF-07.

## SF-02 — Category Detail & Product Filtering

- **Commit:** `2c6f8f1a0f6c20f5fa1d2d9820dd5b5a56f46368`.
- Backend integration tests: **25 passed**.
- Targeted frontend tests: **24 passed**.
- Backend and frontend type checks: **passed**.
- **Evidence classification:** Historical validation result from the prior
  task record; not rerun for SF-07.

## SF-03 — Database Migration Runner

- **Commit:** `263cdec87210b2b8f84db77bd26dd5e5e04d6f6e`.
- Migration-runner integration tests: **6/6 passed**; test database setup
  passed.
- Isolated fresh Docker-volume check applied migrations `001` and `002`;
  `schema_migrations` contained both versions and `auth_sessions` existed.
- Development database schema/data fingerprint was reported unchanged.
- **Evidence classification:** Historical validation result from the prior
  task record; not rerun for SF-07.

## SF-04 — Authentication Session Recovery

- **Commit:** `934ac09c9857be11bc21c604f76389b79fdd3527`.
- Targeted authentication tests: **35 tests across 4 files**.
- Frontend TypeScript check: **passed**.
- **Evidence classification:** Historical validation result from the prior
  task record; not rerun for SF-07.

## SF-05 — API Refresh/Retry Error Propagation

- **Commit:** `fb732544a98adb8bf3f8b1f697e954e5dc63fcf7`.
- Targeted auth/API tests: **36 tests across 3 files**.
- Frontend TypeScript check: **passed**.
- **Evidence classification:** Historical validation result from the prior
  task record; not rerun for SF-07.

## SF-06 — OpenAPI Parity

- **Commit:** `960372bff0ca76a3cc09df7fd949e045f35e9f11`.
- OpenAPI documentation tests: **3/3 passed**.
- `test:typecheck`: **passed**.
- **Evidence classification:** Historical validation result from the prior
  task record; not rerun for SF-07.

## SF-08 — Dropdown Option Fetching Limit

- **Commit:** `297551bbbe33a9a32782c101549f9e2790350d24`.
- Final Vitest summary: **8 test files passed; 61 tests passed**.
- The final test command supplied **9 file paths**, while the available
  Vitest summary reported **8 test files**. The execution output does not
  explain this discrepancy; no cause is inferred here.
- Frontend TypeScript check, file-scoped ESLint, Prettier check, and
  `git diff --check`: **passed**.
- An earlier interim test attempt failed on a product-filter label
  association; that was corrected before the final passing run.
- **Evidence classification:** Historical final execution output in the prior
  task record; not rerun for SF-07.

## SF-07 — Project Progress Ledger

- This documentation task does not run source tests, typecheck, lint, or
  build.
- All five documents were reviewed; commit references, repository status, and
  cross-document phase statuses were reconciled.
- `git diff --check` completed with no reported whitespace errors. At this
  point all four new documents are untracked, so the standard diff check does
  not inspect their contents; they were manually reviewed.
