import {
  createProduct,
  deactivateProduct,
  findAllActiveProducts,
  findProductById,
  findProductBySku,
  updateProduct,
} from "../repositories/product.repositories";

import { findCategoryById } from "../repositories/category.repositories";

import type { ProductListQuery } from "../types/product.types";

import { AppError } from "../errors/app-error";
import { hasPostgresErrorCode } from "../utils/postgres-errors";

import type {
  ProductRecord,
  PublicProduct,
  CreateProductInput,
  UpdateProductInput,
} from "../types/product.types";

/**
 * Convert database product record into public response format.
 */
function toPublicProduct(product: ProductRecord): PublicProduct {
  return {
    id: product.id,
    categoryId: product.category_id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    unitPrice: product.unit_price,
    isActive: product.is_active,
    createdAt: product.created_at,
    updatedAt: product.updated_at,
  };
}

/**
 * Ensure the referenced category exists and is active.
 */
async function ensureActiveCategory(categoryId: string): Promise<void> {
  const category = await findCategoryById(categoryId);

  if (!category || !category.is_active) {
    throw new AppError(404, "CATEGORY_NOT_FOUND", "Active category not found.");
  }
}

/**
 * Retrieve all active products.
 */
/**
 * Retrieve active products with pagination.
 */
export async function getAllProducts(query: ProductListQuery): Promise<{
  products: PublicProduct[];
  total: number;
  limit: number;
  offset: number;
}> {
  const result = await findAllActiveProducts(query);

  return {
    products: result.items.map(toPublicProduct),
    total: result.total,
    limit: query.limit,
    offset: query.offset,
  };
}

/**
 * Retrieve an active product by ID.
 */
export async function getProductById(id: string): Promise<PublicProduct> {
  const product = await findProductById(id);

  if (!product || !product.is_active) {
    throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  }

  return toPublicProduct(product);
}

/**
 * Create a new product.
 */
export async function createNewProduct(
  input: CreateProductInput,
): Promise<PublicProduct> {
  const normalizedSku = input.sku.trim().toUpperCase();
  const normalizedName = input.name.trim();
  const normalizedDescription = input.description?.trim() || null;

  // Ensure the category exists and is active.
  await ensureActiveCategory(input.categoryId);

  // Check whether the SKU has already been used.
  const existingProduct = await findProductBySku(normalizedSku);

  if (existingProduct) {
    throw new AppError(
      409,
      "PRODUCT_SKU_ALREADY_EXISTS",
      "Product SKU is already registered.",
    );
  }

  try {
    const product = await createProduct({
      categoryId: input.categoryId,
      sku: normalizedSku,
      name: normalizedName,
      description: normalizedDescription,
      unitPrice: input.unitPrice,
    });

    return toPublicProduct(product);
  } catch (error: unknown) {
    // Handle duplicate SKU race conditions.
    if (hasPostgresErrorCode(error, "23505")) {
      throw new AppError(
        409,
        "PRODUCT_SKU_ALREADY_EXISTS",
        "Product SKU is already registered.",
      );
    }

    throw error;
  }
}

/**
 * Update an existing active product.
 */
export async function updateExistingProduct(
  id: string,
  input: UpdateProductInput,
): Promise<PublicProduct> {
  const currentProduct = await findProductById(id);

  if (!currentProduct || !currentProduct.is_active) {
    throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  }

  const normalizedInput: UpdateProductInput = {};

  // Validate category when it is being changed.
  if (input.categoryId !== undefined) {
    await ensureActiveCategory(input.categoryId);
    normalizedInput.categoryId = input.categoryId;
  }

  // Normalize SKU and check uniqueness.
  if (input.sku !== undefined) {
    const normalizedSku = input.sku.trim().toUpperCase();

    const existingProduct = await findProductBySku(normalizedSku);

    if (existingProduct && existingProduct.id !== id) {
      throw new AppError(
        409,
        "PRODUCT_SKU_ALREADY_EXISTS",
        "Product SKU is already registered.",
      );
    }

    normalizedInput.sku = normalizedSku;
  }

  if (input.name !== undefined) {
    normalizedInput.name = input.name.trim();
  }

  if (input.description !== undefined) {
    normalizedInput.description = input.description?.trim() || null;
  }

  if (input.unitPrice !== undefined) {
    normalizedInput.unitPrice = input.unitPrice;
  }

  try {
    const updatedProduct = await updateProduct(id, normalizedInput);

    if (!updatedProduct) {
      throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    }

    return toPublicProduct(updatedProduct);
  } catch (error: unknown) {
    // Handle duplicate SKU race conditions.
    if (hasPostgresErrorCode(error, "23505")) {
      throw new AppError(
        409,
        "PRODUCT_SKU_ALREADY_EXISTS",
        "Product SKU is already registered.",
      );
    }

    throw error;
  }
}

/**
 * Deactivate an active product without deleting it.
 */
export async function deactivateExistingProduct(
  id: string,
): Promise<PublicProduct> {
  const currentProduct = await findProductById(id);

  if (!currentProduct || !currentProduct.is_active) {
    throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  }

  const deactivatedProduct = await deactivateProduct(id);

  if (!deactivatedProduct) {
    throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  }

  return toPublicProduct(deactivatedProduct);
}
