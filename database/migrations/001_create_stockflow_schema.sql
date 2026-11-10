-- StockFlow: initial database schema
-- PostgreSQL 18
-- Run once against the empty stockflow_db database.

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Migration history
-- -----------------------------------------------------------------------------
CREATE TABLE schema_migrations (
    version     VARCHAR(100) PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 1. Users
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name     VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(30) NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_users_full_name_not_empty
        CHECK (BTRIM(full_name) <> ''),
    CONSTRAINT chk_users_email_not_empty
        CHECK (BTRIM(email) <> ''),
    CONSTRAINT chk_users_role
        CHECK (role IN ('ADMIN', 'WAREHOUSE_STAFF', 'SALES_STAFF'))
);

-- -----------------------------------------------------------------------------
-- 2. Categories
-- -----------------------------------------------------------------------------
CREATE TABLE categories (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_categories_name_not_empty
        CHECK (BTRIM(name) <> '')
);

-- -----------------------------------------------------------------------------
-- 3. Products
-- -----------------------------------------------------------------------------
CREATE TABLE products (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id BIGINT NOT NULL,
    sku         VARCHAR(50) NOT NULL UNIQUE,
    name        VARCHAR(150) NOT NULL,
    description TEXT,
    unit_price  NUMERIC(14, 2) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id)
        REFERENCES categories (id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_products_sku_not_empty
        CHECK (BTRIM(sku) <> ''),
    CONSTRAINT chk_products_name_not_empty
        CHECK (BTRIM(name) <> ''),
    CONSTRAINT chk_products_unit_price_non_negative
        CHECK (unit_price >= 0)
);

-- -----------------------------------------------------------------------------
-- 4. Warehouses
-- -----------------------------------------------------------------------------
CREATE TABLE warehouses (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code       VARCHAR(30) NOT NULL UNIQUE,
    name       VARCHAR(100) NOT NULL,
    address    TEXT,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_warehouses_code_not_empty
        CHECK (BTRIM(code) <> ''),
    CONSTRAINT chk_warehouses_name_not_empty
        CHECK (BTRIM(name) <> '')
);

-- -----------------------------------------------------------------------------
-- 5. Inventory
-- One row per product per warehouse.
-- -----------------------------------------------------------------------------
CREATE TABLE inventory (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    warehouse_id      BIGINT NOT NULL,
    product_id        BIGINT NOT NULL,
    quantity_on_hand  INTEGER NOT NULL DEFAULT 0,
    reorder_level     INTEGER NOT NULL DEFAULT 0,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_inventory_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_inventory_product
        FOREIGN KEY (product_id)
        REFERENCES products (id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_inventory_warehouse_product
        UNIQUE (warehouse_id, product_id),
    CONSTRAINT chk_inventory_quantity_non_negative
        CHECK (quantity_on_hand >= 0),
    CONSTRAINT chk_inventory_reorder_level_non_negative
        CHECK (reorder_level >= 0)
);

-- -----------------------------------------------------------------------------
-- 6. Customers
-- -----------------------------------------------------------------------------
CREATE TABLE customers (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_code VARCHAR(30) NOT NULL UNIQUE,
    name          VARCHAR(150) NOT NULL,
    email         VARCHAR(150),
    phone         VARCHAR(30),
    address       TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_customers_code_not_empty
        CHECK (BTRIM(customer_code) <> ''),
    CONSTRAINT chk_customers_name_not_empty
        CHECK (BTRIM(name) <> '')
);

-- -----------------------------------------------------------------------------
-- 7. Orders
-- Each order is fulfilled by exactly one warehouse.
-- -----------------------------------------------------------------------------
CREATE TABLE orders (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id  BIGINT NOT NULL,
    warehouse_id BIGINT NOT NULL,
    created_by   BIGINT NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    ordered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_orders_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_orders_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_orders_created_by
        FOREIGN KEY (created_by)
        REFERENCES users (id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_orders_id_warehouse
        UNIQUE (id, warehouse_id),
    CONSTRAINT chk_orders_status
        CHECK (status IN ('DRAFT', 'CONFIRMED', 'CANCELLED')),
    CONSTRAINT chk_orders_status_timestamps
        CHECK (
            (status = 'DRAFT' AND confirmed_at IS NULL AND cancelled_at IS NULL)
            OR
            (status = 'CONFIRMED' AND confirmed_at IS NOT NULL AND cancelled_at IS NULL)
            OR
            (status = 'CANCELLED' AND cancelled_at IS NOT NULL)
        ),
    CONSTRAINT chk_orders_number_not_empty
        CHECK (BTRIM(order_number) <> '')
);

-- -----------------------------------------------------------------------------
-- 8. Order items
-- unit_price is a snapshot of the product price at order creation time.
-- -----------------------------------------------------------------------------
CREATE TABLE order_items (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id   BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity   INTEGER NOT NULL,
    unit_price NUMERIC(14, 2) NOT NULL,

    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id)
        REFERENCES orders (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_order_items_product
        FOREIGN KEY (product_id)
        REFERENCES products (id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_order_items_order_product
        UNIQUE (order_id, product_id),
    CONSTRAINT chk_order_items_quantity_positive
        CHECK (quantity > 0),
    CONSTRAINT chk_order_items_unit_price_non_negative
        CHECK (unit_price >= 0)
);

-- -----------------------------------------------------------------------------
-- 9. Stock movements
-- ORDER_CONFIRM movements decrease stock; ORDER_CANCEL movements restore it.
-- Composite foreign keys ensure the movement matches the order's warehouse
-- and one of that order's products.
-- -----------------------------------------------------------------------------
CREATE TABLE stock_movements (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    warehouse_id  BIGINT NOT NULL,
    product_id    BIGINT NOT NULL,
    performed_by  BIGINT NOT NULL,
    order_id      BIGINT,
    movement_type VARCHAR(30) NOT NULL,
    quantity_delta INTEGER NOT NULL,
    reason        TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_stock_movements_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_stock_movements_product
        FOREIGN KEY (product_id)
        REFERENCES products (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_stock_movements_performed_by
        FOREIGN KEY (performed_by)
        REFERENCES users (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_stock_movements_order_warehouse
        FOREIGN KEY (order_id, warehouse_id)
        REFERENCES orders (id, warehouse_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_stock_movements_order_item
        FOREIGN KEY (order_id, product_id)
        REFERENCES order_items (order_id, product_id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_stock_movements_order_product_type
        UNIQUE (order_id, product_id, movement_type),
    CONSTRAINT chk_stock_movements_type
        CHECK (
            movement_type IN (
                'RECEIPT',
                'ISSUE',
                'ADJUSTMENT',
                'ORDER_CONFIRM',
                'ORDER_CANCEL'
            )
        ),
    CONSTRAINT chk_stock_movements_quantity_sign
        CHECK (
            (movement_type = 'RECEIPT' AND quantity_delta > 0)
            OR (movement_type = 'ISSUE' AND quantity_delta < 0)
            OR (movement_type = 'ADJUSTMENT' AND quantity_delta <> 0)
            OR (movement_type = 'ORDER_CONFIRM' AND quantity_delta < 0)
            OR (movement_type = 'ORDER_CANCEL' AND quantity_delta > 0)
        ),
    CONSTRAINT chk_stock_movements_order_reference
        CHECK (
            (movement_type IN ('ORDER_CONFIRM', 'ORDER_CANCEL') AND order_id IS NOT NULL)
            OR
            (movement_type IN ('RECEIPT', 'ISSUE', 'ADJUSTMENT') AND order_id IS NULL)
        )
);

-- -----------------------------------------------------------------------------
-- 10. Indexes for common lookups and foreign-key access patterns
-- PostgreSQL automatically creates indexes for PRIMARY KEY and UNIQUE constraints.
-- -----------------------------------------------------------------------------
CREATE INDEX idx_products_category_id
    ON products (category_id);

CREATE INDEX idx_inventory_product_id
    ON inventory (product_id);

CREATE INDEX idx_orders_customer_ordered_at
    ON orders (customer_id, ordered_at DESC);

CREATE INDEX idx_orders_warehouse_ordered_at
    ON orders (warehouse_id, ordered_at DESC);

CREATE INDEX idx_orders_created_by
    ON orders (created_by);

CREATE INDEX idx_orders_status_ordered_at
    ON orders (status, ordered_at DESC);

CREATE INDEX idx_order_items_product_id
    ON order_items (product_id);

CREATE INDEX idx_stock_movements_product_warehouse_created_at
    ON stock_movements (product_id, warehouse_id, created_at DESC);

CREATE INDEX idx_stock_movements_performed_by
    ON stock_movements (performed_by);

CREATE INDEX idx_stock_movements_order_warehouse
    ON stock_movements (order_id, warehouse_id)
    WHERE order_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 11. Automatically maintain updated_at timestamps
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_categories_set_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_products_set_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_warehouses_set_updated_at
    BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_inventory_set_updated_at
    BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_customers_set_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orders_set_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 12. Keep stock movement history append-only
-- Use a compensating adjustment instead of editing/deleting historical records.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_stock_movement_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'stock_movements is append-only; create a compensating movement instead';
END;
$$;

CREATE TRIGGER trg_stock_movements_append_only
    BEFORE UPDATE OR DELETE ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION prevent_stock_movement_modification();

-- Record that this migration has been applied.
INSERT INTO schema_migrations (version, description)
VALUES ('001', 'Create initial StockFlow inventory and order management schema');

COMMIT;
