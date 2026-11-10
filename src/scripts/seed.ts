import bcrypt from "bcryptjs";
import type { PoolClient } from "pg";
import { env } from "../config/env";
import { pool } from "../config/database";

type DemoUser = {
  fullName: string;
  email: string;
  role: "ADMIN" | "WAREHOUSE_STAFF" | "SALES_STAFF";
  password: string;
};

type CategorySeed = { name: string; description: string };
type WarehouseSeed = { code: string; name: string; address: string };
type CustomerSeed = {
  customerCode: string;
  name: string;
  email: string;
  phone: string;
  address: string;
};
type ProductSeed = {
  sku: string;
  name: string;
  category: string;
  description: string;
  unitPrice: string;
};
type InventorySeed = {
  sku: string;
  warehouseCode: string;
  quantity: number;
  reorderLevel: number;
};

function requireSeedPassword(name: string, value: string | undefined): string {
  if (!value || value.length < 12) {
    throw new Error(`${name} must be set in .env and contain at least 12 characters.`);
  }
  return value;
}

const demoUsers: DemoUser[] = [
  {
    fullName: "StockFlow Admin",
    email: "admin@stockflow.local",
    role: "ADMIN",
    password: requireSeedPassword("SEED_ADMIN_PASSWORD", env.SEED_ADMIN_PASSWORD)
  },
  {
    fullName: "StockFlow Warehouse Staff",
    email: "warehouse@stockflow.local",
    role: "WAREHOUSE_STAFF",
    password: requireSeedPassword("SEED_WAREHOUSE_PASSWORD", env.SEED_WAREHOUSE_PASSWORD)
  },
  {
    fullName: "StockFlow Sales Staff",
    email: "sales@stockflow.local",
    role: "SALES_STAFF",
    password: requireSeedPassword("SEED_SALES_PASSWORD", env.SEED_SALES_PASSWORD)
  }
];

const categories: CategorySeed[] = [
  { name: "Computers", description: "Desktop computers and laptops" },
  { name: "Computer Accessories", description: "Keyboards, mice, hubs, and related accessories" },
  { name: "Displays", description: "Monitors and display equipment" },
  { name: "Networking", description: "Routers, switches, and network equipment" },
  { name: "Storage & Power", description: "Storage devices and power protection equipment" }
];

const warehouses: WarehouseSeed[] = [
  {
    code: "WH-JKT",
    name: "Jakarta Central Warehouse",
    address: "West Jakarta, Indonesia"
  },
  {
    code: "WH-SBY",
    name: "Surabaya Distribution Center",
    address: "Surabaya, East Java, Indonesia"
  }
];

const customers: CustomerSeed[] = [
  {
    customerCode: "CUST-001",
    name: "PT Nusantara Digital",
    email: "purchasing@nusantaradigital.example",
    phone: "+62-21-555-0101",
    address: "Jakarta, Indonesia"
  },
  {
    customerCode: "CUST-002",
    name: "CV Sukses Komputer",
    email: "procurement@sukseskomputer.example",
    phone: "+62-31-555-0102",
    address: "Surabaya, Indonesia"
  },
  {
    customerCode: "CUST-003",
    name: "PT Cipta Teknologi",
    email: "purchasing@ciptateknologi.example",
    phone: "+62-21-555-0103",
    address: "Tangerang, Indonesia"
  },
  {
    customerCode: "CUST-004",
    name: "Toko Berkah Elektronik",
    email: "orders@berkahelektronik.example",
    phone: "+62-31-555-0104",
    address: "Sidoarjo, Indonesia"
  },
  {
    customerCode: "CUST-005",
    name: "PT Solusi Office",
    email: "supply@solusioffice.example",
    phone: "+62-22-555-0105",
    address: "Bandung, Indonesia"
  }
];

const products: ProductSeed[] = [
  { sku: "LAP-001", name: "Business Laptop 14-inch", category: "Computers", description: "14-inch business laptop", unitPrice: "14999000.00" },
  { sku: "LAP-002", name: "Standard Laptop 15-inch", category: "Computers", description: "15-inch standard productivity laptop", unitPrice: "9499000.00" },
  { sku: "MON-001", name: "LED Monitor 24-inch", category: "Displays", description: "24-inch Full HD monitor", unitPrice: "2199000.00" },
  { sku: "KEY-001", name: "Mechanical Keyboard", category: "Computer Accessories", description: "Mechanical USB keyboard", unitPrice: "899000.00" },
  { sku: "MOU-001", name: "Wireless Mouse", category: "Computer Accessories", description: "Wireless optical mouse", unitPrice: "249000.00" },
  { sku: "HUB-001", name: "USB-C Multiport Hub", category: "Computer Accessories", description: "USB-C hub with multiple ports", unitPrice: "499000.00" },
  { sku: "NET-001", name: "Wi-Fi 6 Router", category: "Networking", description: "Dual-band Wi-Fi 6 router", unitPrice: "1299000.00" },
  { sku: "NET-002", name: "8-Port Gigabit Switch", category: "Networking", description: "Unmanaged 8-port gigabit switch", unitPrice: "749000.00" },
  { sku: "SSD-001", name: "External SSD 1TB", category: "Storage & Power", description: "Portable external solid-state drive", unitPrice: "1499000.00" },
  { sku: "UPS-001", name: "UPS 1200VA", category: "Storage & Power", description: "Uninterruptible power supply, 1200VA", unitPrice: "1899000.00" }
];

const inventory: InventorySeed[] = [
  { sku: "LAP-001", warehouseCode: "WH-JKT", quantity: 12, reorderLevel: 3 },
  { sku: "LAP-001", warehouseCode: "WH-SBY", quantity: 6, reorderLevel: 3 },
  { sku: "LAP-002", warehouseCode: "WH-JKT", quantity: 20, reorderLevel: 5 },
  { sku: "LAP-002", warehouseCode: "WH-SBY", quantity: 10, reorderLevel: 4 },
  { sku: "MON-001", warehouseCode: "WH-JKT", quantity: 30, reorderLevel: 8 },
  { sku: "MON-001", warehouseCode: "WH-SBY", quantity: 12, reorderLevel: 5 },
  { sku: "KEY-001", warehouseCode: "WH-JKT", quantity: 50, reorderLevel: 10 },
  { sku: "KEY-001", warehouseCode: "WH-SBY", quantity: 25, reorderLevel: 8 },
  { sku: "MOU-001", warehouseCode: "WH-JKT", quantity: 70, reorderLevel: 15 },
  { sku: "MOU-001", warehouseCode: "WH-SBY", quantity: 5, reorderLevel: 10 },
  { sku: "HUB-001", warehouseCode: "WH-JKT", quantity: 25, reorderLevel: 7 },
  { sku: "HUB-001", warehouseCode: "WH-SBY", quantity: 15, reorderLevel: 5 },
  { sku: "NET-001", warehouseCode: "WH-JKT", quantity: 15, reorderLevel: 5 },
  { sku: "NET-001", warehouseCode: "WH-SBY", quantity: 8, reorderLevel: 3 },
  { sku: "NET-002", warehouseCode: "WH-JKT", quantity: 18, reorderLevel: 5 },
  { sku: "NET-002", warehouseCode: "WH-SBY", quantity: 9, reorderLevel: 4 },
  { sku: "SSD-001", warehouseCode: "WH-JKT", quantity: 40, reorderLevel: 10 },
  { sku: "SSD-001", warehouseCode: "WH-SBY", quantity: 20, reorderLevel: 6 },
  { sku: "UPS-001", warehouseCode: "WH-JKT", quantity: 10, reorderLevel: 3 },
  { sku: "UPS-001", warehouseCode: "WH-SBY", quantity: 4, reorderLevel: 3 }
];

async function seedUsers(client: PoolClient): Promise<number> {
  for (const user of demoUsers) {
    const passwordHash = await bcrypt.hash(user.password, 12);

    await client.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         role = EXCLUDED.role,
         is_active = TRUE`,
      [user.fullName, user.email, passwordHash, user.role]
    );
  }

  return demoUsers.length;
}

async function seedCategories(client: PoolClient): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const category of categories) {
    const result = await client.query<{ id: string }>(
      `INSERT INTO categories (name, description)
       VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET
         description = EXCLUDED.description,
         is_active = TRUE
       RETURNING id`,
      [category.name, category.description]
    );

    const row = result.rows[0];
    if (!row) throw new Error(`Could not resolve category: ${category.name}`);
    ids.set(category.name, row.id);
  }

  return ids;
}

async function seedWarehouses(client: PoolClient): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const warehouse of warehouses) {
    const result = await client.query<{ id: string }>(
      `INSERT INTO warehouses (code, name, address)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         address = EXCLUDED.address,
         is_active = TRUE
       RETURNING id`,
      [warehouse.code, warehouse.name, warehouse.address]
    );

    const row = result.rows[0];
    if (!row) throw new Error(`Could not resolve warehouse: ${warehouse.code}`);
    ids.set(warehouse.code, row.id);
  }

  return ids;
}

async function seedCustomers(client: PoolClient): Promise<number> {
  for (const customer of customers) {
    await client.query(
      `INSERT INTO customers (customer_code, name, email, phone, address)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (customer_code) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         phone = EXCLUDED.phone,
         address = EXCLUDED.address`,
      [customer.customerCode, customer.name, customer.email, customer.phone, customer.address]
    );
  }

  return customers.length;
}

async function seedProducts(
  client: PoolClient,
  categoryIds: Map<string, string>
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const product of products) {
    const categoryId = categoryIds.get(product.category);
    if (!categoryId) throw new Error(`Unknown category: ${product.category}`);

    const result = await client.query<{ id: string }>(
      `INSERT INTO products (category_id, sku, name, description, unit_price)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (sku) DO UPDATE SET
         category_id = EXCLUDED.category_id,
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         unit_price = EXCLUDED.unit_price,
         is_active = TRUE
       RETURNING id`,
      [categoryId, product.sku, product.name, product.description, product.unitPrice]
    );

    const row = result.rows[0];
    if (!row) throw new Error(`Could not resolve product: ${product.sku}`);
    ids.set(product.sku, row.id);
  }

  return ids;
}

async function seedInventoryAndOpeningMovements(
  client: PoolClient,
  productIds: Map<string, string>,
  warehouseIds: Map<string, string>,
  adminUserId: string
): Promise<{ inventoryInserted: number; movementsInserted: number }> {
  let inventoryInserted = 0;
  let movementsInserted = 0;

  for (const item of inventory) {
    const productId = productIds.get(item.sku);
    const warehouseId = warehouseIds.get(item.warehouseCode);

    if (!productId || !warehouseId) {
      throw new Error(`Missing product or warehouse for ${item.sku}/${item.warehouseCode}`);
    }

    const result = await client.query<{ id: string }>(
      `INSERT INTO inventory (warehouse_id, product_id, quantity_on_hand, reorder_level)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (warehouse_id, product_id) DO NOTHING
       RETURNING id`,
      [warehouseId, productId, item.quantity, item.reorderLevel]
    );

    // Create the opening stock movement only when a new inventory row is inserted.
    if (result.rowCount === 1) {
      inventoryInserted += 1;

      await client.query(
        `INSERT INTO stock_movements
           (warehouse_id, product_id, performed_by, movement_type, quantity_delta, reason)
         VALUES ($1, $2, $3, 'RECEIPT', $4, $5)`,
        [
          warehouseId,
          productId,
          adminUserId,
          item.quantity,
          "Initial stock received during StockFlow demo data seeding"
        ]
      );

      movementsInserted += 1;
    }
  }

  return { inventoryInserted, movementsInserted };
}

async function seedDatabase(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    console.log("Seeding demo users...");
    await seedUsers(client);

    const adminResult = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1",
      ["admin@stockflow.local"]
    );
    const adminUserId = adminResult.rows[0]?.id;
    if (!adminUserId) throw new Error("Demo admin user could not be resolved.");

    console.log("Seeding categories and warehouses...");
    const categoryIds = await seedCategories(client);
    const warehouseIds = await seedWarehouses(client);

    console.log("Seeding customers and products...");
    await seedCustomers(client);
    const productIds = await seedProducts(client, categoryIds);

    console.log("Seeding inventory and opening stock movements...");
    const stockResult = await seedInventoryAndOpeningMovements(
      client,
      productIds,
      warehouseIds,
      adminUserId
    );

    await client.query("COMMIT");

    console.log("\n----------------------------------------");
    console.log("STOCKFLOW DATABASE SEED COMPLETED");
    console.log("----------------------------------------");
    console.log(`Demo users ensured: ${demoUsers.length}`);
    console.log(`Categories ensured: ${categories.length}`);
    console.log(`Warehouses ensured: ${warehouses.length}`);
    console.log(`Customers ensured: ${customers.length}`);
    console.log(`Products ensured: ${products.length}`);
    console.log(`New inventory rows: ${stockResult.inventoryInserted}`);
    console.log(`New opening stock movements: ${stockResult.movementsInserted}`);
    console.log("Existing inventory quantities were not overwritten.");
    console.log("----------------------------------------\n");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("StockFlow seeding failed. Transaction rolled back.");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void seedDatabase().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
