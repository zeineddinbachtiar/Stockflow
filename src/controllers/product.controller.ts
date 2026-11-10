
import type { RequestHandler, Response } from "express";
import { positiveBigIntIdSchema } from "../validators/common.validator";

import {
  ProductServiceError,
  createNewProduct,
  deactivateExistingProduct,
  getAllProducts,
  getProductById,
  updateExistingProduct,
} from "../services/product.service";

import type {
  CreateProductInput,
  UpdateProductInput,
} from "../types/product.types";

/**
 * Validate and retrieve product ID from route parameters.
 */
function getProductId(
  param: unknown,
  res: Response
): string | null {
  const parsed = positiveBigIntIdSchema.safeParse(param);

  if (!parsed.success) {
    res.status(400).json({
      status: "error",
      code: "INVALID_PRODUCT_ID",
      message: "Product ID must be a valid positive BIGINT.",
    });

    return null;
  }

  return parsed.data;
}

/**
 * Handle errors returned by product service.
 */
function handleProductError(error: unknown, res: Response): void {
  if (error instanceof ProductServiceError) {
    let statusCode = 500;

    if (error.code === "PRODUCT_NOT_FOUND" ||
        error.code === "CATEGORY_NOT_FOUND") {
      statusCode = 404;
    } else if (error.code === "PRODUCT_SKU_ALREADY_EXISTS") {
      statusCode = 409;
    }

    res.status(statusCode).json({
      status: "error",
      code: error.code,
      message: error.message,
    });

    return;
  }

  console.error("Product controller error:", error);

  res.status(500).json({
    status: "error",
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred.",
  });
}

/**
 * GET /api/v1/products
 */
export const listProducts: RequestHandler = async (_req, res) => {
  try {
    const products = await getAllProducts();

    res.status(200).json({
      status: "success",
      data: {
        products,
      },
    });
  } catch (error: unknown) {
    handleProductError(error, res);
  }
};

/**
 * GET /api/v1/products/:id
 */
export const getProduct: RequestHandler = async (req, res) => {
  try {
    const productId = getProductId(req.params.id, res);

    if (!productId) return;

    const product = await getProductById(productId);

    res.status(200).json({
      status: "success",
      data: {
        product,
      },
    });
  } catch (error: unknown) {
    handleProductError(error, res);
  }
};

/**
 * POST /api/v1/products
 */
export const createProductController: RequestHandler = async (
  req,
  res
) => {
  try {
    const input = req.body as CreateProductInput;

    const product = await createNewProduct(input);

    res.status(201).json({
      status: "success",
      message: "Product created successfully.",
      data: {
        product,
      },
    });
  } catch (error: unknown) {
    handleProductError(error, res);
  }
};

/**
 * PATCH /api/v1/products/:id
 */
export const updateProductController: RequestHandler = async (
  req,
  res
) => {
  try {
    const productId = getProductId(req.params.id, res);

    if (!productId) return;

    const input = req.body as UpdateProductInput;

    const product = await updateExistingProduct(productId, input);

    res.status(200).json({
      status: "success",
      message: "Product updated successfully.",
      data: {
        product,
      },
    });
  } catch (error: unknown) {
    handleProductError(error, res);
  }
};

/**
 * PATCH /api/v1/products/:id/deactivate
 */
export const deactivateProductController: RequestHandler = async (
  req,
  res
) => {
  try {
    const productId = getProductId(req.params.id, res);

    if (!productId) return;

    const product = await deactivateExistingProduct(productId);

    res.status(200).json({
      status: "success",
      message: "Product deactivated successfully.",
      data: {
        product,
      },
    });
  } catch (error: unknown) {
    handleProductError(error, res);
  }
};
