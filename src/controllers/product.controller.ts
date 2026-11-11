
import type { RequestHandler, Response } from "express";
import { positiveBigIntIdSchema } from "../validators/common.validator";
import { parsePositiveBigIntId } from "../utils/route-params";

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
function getProductId(param: unknown): string {
  return parsePositiveBigIntId(
    param,
    "INVALID_PRODUCT_ID",
    "Product"
  );
}

/**
 * Handle errors returned by product service.
 */
function handleProductError(
  error: unknown,
  _res: Response
): never {
  throw error;
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
    const productId = getProductId(req.params.id);

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
    const productId = getProductId(req.params.id);

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
    const productId = getProductId(req.params.id);

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
