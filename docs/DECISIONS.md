# Decisions

## SF-01 — Reversible Product Lifecycle

Product deactivation is a reversible lifecycle state, not deletion. A product
may be deactivated with zero or positive stock, and every existing inventory
balance remains visible by warehouse.

- Active products remain the default result for `GET /products`. Only ADMIN
  may request `status=inactive` or reactivate a product.
- Inactive products cannot be used for receipts, positive adjustments, reorder
  level changes, new orders, draft item updates, or order confirmation.
- ADMIN and WAREHOUSE_STAFF may clear an inactive product's existing balance
  using ISSUE or a negative ADJUSTMENT. Neither operation may reduce stock
  below zero.
- Clearance must target an inventory balance that already exists. It must not
  create a zero-balance inventory row for an inactive product.
- Reactivation restores normal active-product behavior. A confirmed order may
  still be cancelled after deactivation; cancellation restores its stock and
  records the existing order-cancellation movement.
- Product status changes and stock operations serialize on a product row lock.
  Balance updates and stock movement records remain atomic.

Operationally, deactivation does not dispose of or transfer stock. Staff must
clear each warehouse balance through the allowed clearance operations before
the product is considered physically depleted. Existing inactive stock remains
available for audit and inventory review until cleared or the product is
reactivated.
