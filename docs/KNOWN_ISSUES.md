# StockFlow Known Issues and Work Register

This register keeps resolved work for traceability and leaves incomplete work
visible. Priorities not supported by the available evidence are marked
**Unverified**, not guessed. Statuses follow the project ledger vocabulary.
For SF-09 through SF-14, initial findings are from *StockFlow Source Audit &
Recovery Plan* (17 November 2026), Section 5; current status is distinguished
below and cross-checked against the current repository.

## SF-01 — Reversible Product Lifecycle

- **Priority:** P1 runtime/business-risk work; exact issue priority was not
  independently recorded.
- **Problem:** Product deactivation needed to be reversible and safe while
  inventory and draft/confirmed orders could still reference the product.
- **Evidence:** [product service](../src/services/product.service.ts),
  [product repository](../src/repositories/product.repositories.ts),
  [product controller](../src/controllers/product.controller.ts),
  [lifecycle integration tests](../tests/integration/product-lifecycle.test.ts),
  [inventory integration tests](../tests/integration/inventory.test.ts),
  [order integration tests](../tests/integration/order.test.ts), and the
  approved decision in [DECISIONS.md](./DECISIONS.md).
- **Impact:** Incorrect inactive-product handling could block legitimate
  clearance or permit invalid receipts, adjustments, or orders.
- **Acceptance/resolution:** Approved inactive-product restrictions,
  clearance without negative balances or empty-row creation, reactivation
  authorization, order validation, and cancellation stock restoration.
- **Status:** **Committed** — `827827bd374bd40f112718007446b8c159c1d9e2`.

## SF-02 — Category Detail & Product Filtering

- **Priority:** Unverified.
- **Problem:** Category detail and end-to-end `categoryId` product filtering
  were missing or inconsistent.
- **Evidence:** [product API implementation](../src/repositories/product.repositories.ts),
  [product types and validator](../src/types/product.types.ts),
  [CategoryDetailPage](../frontend/src/pages/CategoryDetailPage.tsx), and
  [integration tests](../tests/integration/master-data.test.ts).
- **Impact:** Users could not reliably inspect products belonging to a
  category; counts and result pages could disagree.
- **Acceptance/resolution:** Category detail, validated `categoryId`
  filtering through SQL, consistent data/count filters with pagination, UI
  states, and OpenAPI parity.
- **Status:** **Committed** — `2c6f8f1a0f6c20f5fa1d2d9820dd5b5a56f46368`.

## SF-03 — Database Migration Runner

- **Priority:** P1 reliability work; exact issue priority was not independently
  recorded.
- **Problem:** Existing SQL migrations needed an explicit, safe application
  runner for fresh and existing databases.
- **Evidence:** [migration runner](../scripts/migrate.mjs),
  [runner tests](../tests/integration/migration-runner.test.ts), and
  [migration SQL](../database/migrations).
- **Impact:** Untracked schema changes or unsafe resets could make deployments
  inconsistent or risk existing data.
- **Acceptance/resolution:** Version discovery, transactional/idempotent
  execution, advisory locking, failure rollback, existing-data preservation,
  and documented manual invocation.
- **Status:** **Committed** — `263cdec87210b2b8f84db77bd26dd5e5e04d6f6e`.

## SF-04 — Authentication Session Recovery

- **Priority:** P1 runtime/authentication work; exact issue priority was not
  independently recorded.
- **Problem:** An expired access token could cause a stored session to be
  discarded even when its refresh token remained usable.
- **Evidence:** [AuthContext](../frontend/src/context/AuthContext.tsx),
  [AuthContext tests](../frontend/src/context/AuthContext.test.tsx),
  [API client](../frontend/src/lib/api.ts), and
  [API client tests](../frontend/src/lib/api.test.ts).
- **Impact:** Users could be signed out unnecessarily or protected content
  could render before session recovery completed.
- **Acceptance/resolution:** Startup refresh for expired access tokens,
  token-rotation persistence, transient-failure retention/retry, and no
  duplicate startup refresh.
- **Status:** **Committed** — `934ac09c9857be11bc21c604f76389b79fdd3527`.

## SF-05 — API Refresh/Retry Error Propagation

- **Priority:** P1 runtime/authentication work; exact issue priority was not
  independently recorded.
- **Problem:** Refresh and authenticated retry paths needed to distinguish
  definitive rejection from network/server failure and preserve the original
  error.
- **Evidence:** [API client](../frontend/src/lib/api.ts),
  [AuthContext](../frontend/src/context/AuthContext.tsx),
  [API client tests](../frontend/src/lib/api.test.ts), and
  [AuthContext tests](../frontend/src/context/AuthContext.test.tsx).
- **Impact:** Transient errors could be misreported as unauthorized responses,
  sessions could be lost, or retries could loop.
- **Acceptance/resolution:** Correct 401 handling, propagation of network/5xx
  errors, bounded retry, concurrent refresh deduplication, and no refresh on
  public endpoints.
- **Status:** **Committed** — `fb732544a98adb8bf3f8b1f697e954e5dc63fcf7`.

## SF-06 — OpenAPI Parity

- **Priority:** Unverified.
- **Problem:** Authentication endpoint documentation did not fully match the
  implemented request, response, security, and error contracts.
- **Evidence:** [OpenAPI document](../src/docs/openapi.json) and
  [documentation integration tests](../tests/integration/docs.test.ts).
- **Impact:** API consumers could rely on undocumented or incorrect
  authentication behavior.
- **Acceptance/resolution:** Document actual refresh/logout behavior, token
  fields, response schemas, status codes, security requirements, and errors;
  verify the affected contract with tests.
- **Status:** **Committed** — `960372bff0ca76a3cc09df7fd949e045f35e9f11`.

## SF-07 — Project Progress Ledger

- **Priority:** Unverified.
- **Problem:** No evidence-based project status, roadmap, known-issue, and
  validation ledger was present under `docs/`.
- **Evidence:** At audit start, `docs/` contained only
  [DECISIONS.md](./DECISIONS.md).
- **Impact:** Project completion, blockers, historical validation, and next
  actions were difficult to reconcile.
- **Acceptance/resolution:** Add and review `PROJECT_STATUS.md`, `ROADMAP.md`,
  `KNOWN_ISSUES.md`, and `VALIDATION_LOG.md`; preserve existing decisions and
  verify Git references and working-tree scope.
- **Status:** **In Progress** — documentation is being added and is not
  committed.

## SF-08 — Dropdown Option Fetching Limit

- **Priority:** Unverified.
- **Problem:** API-backed dropdowns initially fetched at most 100 options,
  hiding records beyond that page.
- **Evidence:** [LoadMoreOptions](../frontend/src/components/ui/LoadMoreOptions.tsx),
  [InventoryPage](../frontend/src/pages/InventoryPage.tsx),
  [OrdersPage](../frontend/src/pages/OrdersPage.tsx),
  [ProductsPage](../frontend/src/pages/ProductsPage.tsx),
  [StockMovementsPage](../frontend/src/pages/StockMovementsPage.tsx),
  [order option tests](../frontend/src/pages/OrdersPage.test.tsx),
  [category option tests](../frontend/src/pages/ProductsPage.test.tsx), and
  [movement option tests](../frontend/src/pages/StockMovementsPage.test.tsx).
- **Impact:** Users could not select otherwise available products, customers,
  warehouses, or categories after the first page.
- **Acceptance/resolution:** Paginate on demand, use server-side product
  search where supported, preserve selected values, and expose next-page
  errors/retry without loading all records at once.
- **Status:** **Committed** — `297551bbbe33a9a32782c101549f9e2790350d24`.

## SF-09 — Inconsistent Master-Data Archive and Reactivation Lifecycle

- **Priority:** P2.
- **Problem:** The initial audit found inconsistent inactive-resource
  discovery and reactivation across warehouses, categories, and products.
- **Initial audit finding:** A warehouse reactivation endpoint and frontend API
  wrapper existed, but there was no inactive listing or reactivation UI.
  Category and product reactivation endpoints were absent at that time. Active
  products could remain in inactive categories, while order confirmation
  checked product activity only.
- **Current implementation:** Product lifecycle is **resolved through SF-01**
  (committed as `827827bd374bd40f112718007446b8c159c1d9e2`). Warehouse
  reactivation remains available through an ADMIN endpoint and API wrapper,
  but the warehouse page still lists active warehouses and offers no inactive
  listing/reactivation flow. Categories still have deactivation but no
  reactivation endpoint or inactive-management flow. Category deactivation
  does not resolve the related-product policy; see SF-13.
- **Evidence:** [warehouse routes](../src/routes/warehouse.routes.ts),
  [warehouse service](../src/services/warehouse.service.ts),
  [warehouse API](../frontend/src/features/warehouses/warehouse.api.ts),
  [WarehousesPage](../frontend/src/pages/WarehousesPage.tsx),
  [category routes](../src/routes/category.routes.ts),
  [category service](../src/services/category.service.ts),
  [CategoriesPage](../frontend/src/pages/CategoriesPage.tsx),
  and [order service](../src/services/order.service.ts).
- **Impact:** Operators cannot manage inactive warehouses consistently from
  the UI, and category lifecycle can leave active products usable under an
  inactive category without a documented cross-entity rule.
- **Acceptance:** Define archive/reactivation behavior per resource; provide
  the required inactive discovery and authorized reactivation flows; define
  and test related inventory/order/product behavior without assuming cascade
  semantics.
- **Status:** **In Progress** — product lifecycle is resolved by SF-01;
  warehouse and category lifecycle remain outstanding.

## SF-10 — Incomplete Operational Frontend Workflow Tests

- **Priority:** P2.
- **Problem:** Operational frontend coverage did not establish complete
  inventory and order workflows, and a full-stack E2E workflow was absent.
- **Initial audit finding:** Inventory UI tests did not clearly establish
  complete issue, adjustment, and reorder-level flows. Orders UI tests lacked
  the complete draft-create/edit/confirm/cancel lifecycle. No Playwright or
  Cypress full-stack workflow was found.
- **Current implementation:** Inventory tests now cover receipt, inactive
  stock issue/negative adjustment restrictions, and option-query errors, but
  do not prove all inventory mutation flows (including reorder-level
  management) end to end through the UI. Orders tests cover options and
  selected workflow cases, while the form test checks payload/validation; the
  page-level draft-create/edit/confirm/cancel lifecycle is still not
  established. `tests/setup/smoke.test.ts` checks test DB isolation and API
  health; it is not the missing UI-to-API-to-database workflow. SF-08 covers
  dropdown option fetching only and does not close this issue.
- **Evidence:** [InventoryPage tests](../frontend/src/pages/InventoryPage.test.tsx),
  [OrdersPage tests](../frontend/src/pages/OrdersPage.test.tsx),
  [OrderFormDialog tests](../frontend/src/features/orders/OrderFormDialog.test.tsx),
  and [setup smoke tests](../tests/setup/smoke.test.ts).
- **Impact:** UI regressions in operational mutations or the end-to-end stock
  lifecycle can escape the existing targeted tests.
- **Acceptance:** Verify inventory issue, adjustment, and reorder-level
  workflows including success and error states; verify order draft creation,
  editing, confirmation, cancellation, and expected stock effects through the
  UI; add a role-appropriate full-stack smoke flow from login through
  confirmation and cancellation/restoration.
- **Status:** **In Progress** — SF-08 is committed as 7.4.3; inventory/order
  workflow coverage and full-stack E2E remain open.

## SF-11 — Modal Lifecycle and Accessibility Gaps

- **Priority:** P2.
- **Problem:** Modal lifecycle and keyboard accessibility are inconsistent
  across shared and detail dialogs.
- **Initial audit finding:** The key handler was attached to the dialog rather
  than a document-level focus boundary; programmatic focus escape was not
  fully restored; Escape could close during submission despite disabled close
  controls; some detail dialogs duplicated `role="dialog"` markup.
- **Current implementation:** A shared `ModalDialog`, `ConfirmDialog`, and
  `useModalDialog` provide dialog semantics, body-scroll locking, initial and
  restored focus, Escape handling, and Tab wrapping. The related foundation
  was committed in `9f2225b14a5ba00749a9ddd580b5267d4369ed2c`
  (`feat(ui): implement accessible modal confirmations`). Gaps remain:
  keyboard handling is attached to the dialog, focus moved programmatically
  outside is not reclaimed, Escape always invokes `onClose` even when
  `closeDisabled` or a mutation is active, and several detail dialogs still
  implement their own dialog markup.
- **Evidence:** [useModalDialog](../frontend/src/components/ui/useModalDialog.ts),
  [ModalDialog](../frontend/src/components/ui/ModalDialog.tsx),
  [ConfirmDialog](../frontend/src/components/ui/ConfirmDialog.tsx),
  [ModalDialog tests](../frontend/src/components/ui/ModalDialog.test.tsx),
  [OrdersPage](../frontend/src/pages/OrdersPage.tsx), and
  [CustomersPage](../frontend/src/pages/CustomersPage.tsx).
- **Impact:** Keyboard users can lose modal focus or dismiss an in-flight
  operation unexpectedly; duplicated dialog implementations can diverge.
- **Acceptance:** Use a consistent modal primitive with a reliable focus
  boundary and restoration, configurable Escape behavior that respects
  pending mutations, accessible background behavior, and keyboard tests for
  focus escape, Tab, Escape, and pending-submit cases.
- **Status:** **In Progress** — shared modal work is present, but the
  focus-boundary and Escape gaps remain unresolved.

## SF-12 — Stale-Data Errors Can Be Hidden

- **Priority:** P2.
- **Problem:** A failed refetch can leave previous page/filter data visible
  without clearly warning the user that it is stale.
- **Initial audit finding:** Queries using `placeholderData: (previousData) =>
  previousData` could retain prior results while list errors were rendered
  only when the result list was empty.
- **Current implementation:** This pattern remains in list pages, including
  inventory, orders, products, categories, customers, warehouses, and stock
  movements. Their list error state commonly depends on the displayed array
  being empty, so a failed background/page/filter refetch with previous data
  can be hidden.
- **Evidence:** [InventoryPage](../frontend/src/pages/InventoryPage.tsx),
  [OrdersPage](../frontend/src/pages/OrdersPage.tsx),
  [ProductsPage](../frontend/src/pages/ProductsPage.tsx),
  [CategoriesPage](../frontend/src/pages/CategoriesPage.tsx),
  [CustomersPage](../frontend/src/pages/CustomersPage.tsx),
  [WarehousesPage](../frontend/src/pages/WarehousesPage.tsx), and
  [StockMovementsPage](../frontend/src/pages/StockMovementsPage.tsx).
- **Impact:** Users may mistake old-page or old-filter results for the
  requested current data and may not know a refresh failed.
- **Acceptance:** Distinguish initial-load and background/refetch errors,
  show an explicit stale-data warning when prior data is retained, and avoid
  presenting prior-page/filter results as current without clear indication.
- **Status:** **Planned** — no SF-12 implementation is recorded.

## SF-13 — Category Deactivation Policy with Active Products Is Undefined

- **Priority:** P2.
- **Problem:** The business rule for deactivating a category that contains
  active products is undefined.
- **Initial audit finding:** Active products in inactive categories remained
  usable in orders; order confirmation validated product status but not
  category status.
- **Current implementation:** Category deactivation does not inspect or
  change related products. Product creation/category reassignment requires an
  active category, but order confirmation checks product activity only. No
  approved cascade or prohibition policy is recorded; this is a decision
  still needed, not permission to add cascade behavior.
- **Evidence:** [category service](../src/services/category.service.ts),
  [category repository](../src/repositories/category.repositories.ts),
  [product service](../src/services/product.service.ts), and
  [order service](../src/services/order.service.ts).
- **Impact:** The category's inactive status does not prevent an already
  associated active product from being selected or confirmed in an order.
  Changing this behavior without a decision could unexpectedly block
  transactions or alter related products.
- **Acceptance:** Decide and document whether category deactivation is
  blocked while active products exist, archives related products, or only
  removes the category from new selections; then implement and test the
  chosen rule without assuming cascade behavior.
- **Status:** **Planned** — awaiting an explicit business decision; no new
  decision is recorded in [DECISIONS.md](./DECISIONS.md).

## SF-14 — Documentation and Frontend Cleanup

- **Priority:** P3.
- **Problem:** Project and frontend documentation/metadata and small cleanup
  items remain inconsistent or incomplete.
- **Initial audit finding:** The audit identified incomplete root/frontend
  README coverage, stale authentication documentation, generic
  `frontend/index.html` language/title, apparently unused assets, duplicate
  comments, and potentially duplicated test-database migration verification.
- **Current implementation:** The root README contains setup and migration
  guidance added with SF-03, and SF-07 adds project tracking docs, but the
  frontend README remains the Vite template and the root authentication
  section describes login/access tokens without the full refresh/logout
  contract. `frontend/index.html` still has `lang="en"` and the title
  `frontend`. `frontend/src/assets/hero.png`, `react.svg`, and `vite.svg` have
  no references under `frontend/src` or `frontend/index.html` in the current
  search; confirm references across the full project before removal. The
  current test DB setup calls the shared migration runner and separately
  verifies required tables; the audit's duplication concern is historical
  and should be re-evaluated before any cleanup. No asset, comment, or
  runtime cleanup was made for this issue.
- **Evidence:** [root README](../README.md), [frontend README](../frontend/README.md),
  [frontend HTML entry](../frontend/index.html),
  [frontend assets](../frontend/src/assets),
  and [test DB setup](../scripts/setup-test-db.mjs).
- **Impact:** Contributors may follow generic or incomplete setup/auth
  guidance; browser metadata may not identify the application; unverified
  cleanup could remove referenced assets or useful checks.
- **Acceptance:** Complete the root and frontend README content (including
  actual auth/session behavior), set accurate frontend language/title,
  verify asset/comment references before removing anything, and retain only
  necessary test-database verification. Validate cleanup without changing
  runtime behavior.
- **Status:** **In Progress** — some setup and project-ledger documentation
  exists, but the audit's remaining documentation/metadata cleanup is
  outstanding.
