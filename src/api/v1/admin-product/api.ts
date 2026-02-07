import express from "express";
import asyncHandler from "../../../utils/async-handler.js";
import response from "../../../utils/response.js";
import checkCookies from "../../../utils/m-check-cookies.js";
import InputSensitization from "../../../utils/m-input-sensitization.js";
import Product from "../../../schema/product.js";
import mongoose from "mongoose";

const router = express.Router();

// List Products (admin)
router.get(
  "/product/list",
  checkCookies,
  asyncHandler(async (req, res) => {
    const {
      page,
      limit,
      search,
      category,
      status,
      priceMin,
      priceMax,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
    } = req.query;

    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;
    const skip = (pageNumber - 1) * limitNumber;

    const query: Record<string, unknown> = {};

    if (search && typeof search === "string") {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }

    if (category && typeof category === "string") {
      query.category = category;
    }

    if (status && typeof status === "string" && status !== "all") {
      if (status === "live") query.isActive = true;
      else if (status === "draft") query.isActive = false;
    }

    if (priceMin || priceMax) {
      const priceQ: Record<string, number> = {};
      if (priceMin) priceQ.$gte = Number(priceMin);
      if (priceMax) priceQ.$lte = Number(priceMax);
      if (Object.keys(priceQ).length) query.price = priceQ;
    }

    if (dateFrom || dateTo) {
      const dateQ: Record<string, Date> = {};
      if (dateFrom) dateQ.$gte = new Date(dateFrom as string);
      if (dateTo) dateQ.$lte = new Date(dateTo as string);
      if (Object.keys(dateQ).length) query.createdAt = dateQ;
    }

    const sortField = (sortBy as string) || "createdAt";
    const order = sortOrder === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: order };

    const [products, total] = await Promise.all([
      Product.find(query).sort(sort).skip(skip).limit(limitNumber).lean(),
      Product.countDocuments(query),
    ]);

    return response.success(res, "Products retrieved successfully", 200, {
      products,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  }),
);

// Get single product (admin)
router.get(
  "/product/:productId",
  checkCookies,
  asyncHandler(async (req, res) => {
    const productId = req.params.productId;

    if (!productId) {
      return response.failure(res, "Product ID is required", 400);
    }

    const product = await Product.findById(productId).lean();

    if (!product) {
      return response.failure(res, "Product not found", 404);
    }

    return response.success(res, "Product retrieved successfully", 200, product);
  }),
);

// Create Product
router.post(
  "/product/create",
  checkCookies,
  InputSensitization,
  asyncHandler(async (req, res) => {
    const createProduct = await Product.create({
      ...req.body,
    });

    return response.success(
      res,
      "Product created successfully",
      200,
      createProduct,
    );
  }),
);

// Add Product Variant
router.post(
  "/product/variant/add/:productId",
  checkCookies,
  InputSensitization,
  asyncHandler(async (req, res) => {
    if (!req.params.productId) {
      return response.failure(res, "Product ID is required", 400);
    }
    const product = await Product.findByIdAndUpdate(
      {
        _id: req.params.productId,
      },
      {
        $push: { variants: req.body },
      },
      {
        new: true,
      },
    ).lean();

    if (!product) {
      return response.failure(res, "Product not found", 404);
    }

    return response.success(res, "Product variant added successfully", 200, {
      variants: product.variants,
    });
  }),
);

// Edit Product
router.patch(
  "/product/edit/:productId",
  checkCookies,
  asyncHandler(async (req, res) => {
    if (!req.params.productId) {
      return response.failure(res, "Product ID is required", 400);
    }
    const updatedProduct = await Product.findByIdAndUpdate(
      {
        _id: req.params.productId,
      },
      {
        $set: req.body,
      },
      { new: true },
    ).lean();

    if (!updatedProduct) {
      return response.failure(res, "Product not found", 404);
    }

    return response.success(
      res,
      "Product updated successfully",
      200,
      updatedProduct,
    );
  }),
);

// Edit Product Variant
router.patch(
  "/product/variant/edit/:productId/:variantId",
  checkCookies,
  asyncHandler(async (req, res) => {
    if (!req.params.productId || !req.params.variantId) {
      return response.failure(
        res,
        "Product ID and Variant ID are required",
        400,
      );
    }

    const product = await Product.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(req.params.productId as string),
        "variants._id": new mongoose.Types.ObjectId(
          req.params.variantId as string,
        ),
      },
      {
        $set: {
          "variants.$": { ...req.body },
        },
      },
      { new: true },
    ).lean();

    if (!product) {
      return response.failure(res, "Product or Variant not found", 404);
    }

    return response.success(res, "Product variant updated successfully", 200, {
      variants: product.variants,
    });
  }),
);

// Delete a product variant
router.delete(
  "/product/variant/delete/:productId/:variantId",
  checkCookies,
  asyncHandler(async (req, res) => {
    if (!req.params.productId || !req.params.variantId) {
      return response.failure(
        res,
        "Product ID and Variant ID are required",
        400,
      );
    }

    const product = await Product.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(req.params.productId as string),
      },
      {
        $pull: {
          variants: {
            _id: new mongoose.Types.ObjectId(req.params.variantId as string),
          },
        },
      },
      { new: true },
    ).lean();

    if (!product) {
      return response.failure(res, "Product or Variant not found", 404);
    }

    return response.success(
      res,
      "Product variant deleted successfully",
      200,
      [],
    );
  }),
);

// Delete whole Product
router.delete(
  "/product/delete/:productId",
  checkCookies,
  asyncHandler(async (req, res) => {
    if (!req.params.productId) {
      return response.failure(res, "Product ID is required", 400);
    }

    const deletedProduct = await Product.findByIdAndDelete(
      req.params.productId,
    ).lean();

    if (!deletedProduct) {
      return response.failure(res, "Product not found", 404);
    }

    return response.success(
      res,
      "Product deleted successfully",
      200,
      deletedProduct,
    );
  }),
);

export default router;
