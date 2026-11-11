import type { RequestHandler } from "express";

import { parsePositiveBigIntId } from "../utils/route-params";

import {
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
  return parsePositiveBigIntId(param, "INVALID_PRODUCT_ID", "Product");
}

/**
 * GET /api/v1/products
 */
export const listProducts: RequestHandler = async (_req, res) => {
  const products = await getAllProducts();

  res.status(200).json({
    status: "success",
    data: {
      products,
    },
  });
};

/**
 * GET /api/v1/products/:id
 */
export const getProduct: RequestHandler = async (req, res) => {
  const productId = getProductId(req.params.id);

  const product = await getProductById(productId);

  res.status(200).json({
    status: "success",
    data: {
      product,
    },
  });
};

/**
 * POST /api/v1/products
 */
export const createProductController: RequestHandler = async (req, res) => {
  const input = req.body as CreateProductInput;

  const product = await createNewProduct(input);

  res.status(201).json({
    status: "success",
    message: "Product created successfully.",
    data: {
      product,
    },
  });
};

/**
 * PATCH /api/v1/products/:id
 */
export const updateProductController: RequestHandler = async (req, res) => {
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
};

/**
 * PATCH /api/v1/products/:id/deactivate
 */
export const deactivateProductController: RequestHandler = async (req, res) => {
  const productId = getProductId(req.params.id);

  const product = await deactivateExistingProduct(productId);

  res.status(200).json({
    status: "success",
    message: "Product deactivated successfully.",
    data: {
      product,
    },
  });
};
