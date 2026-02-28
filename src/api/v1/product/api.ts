import express from "express";
import asyncHandler from "../../../utils/async-handler.js";
import response from "../../../utils/response.js";
import Product from "../../../schema/product.js";
import Review from "../../../schema/review.js";

const router = express.Router();

// Latest products (sorted by newest first)
router.get(
  "/latest",
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit) || 8;
    const products = await Product.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return response.success(res, "Latest products retrieved", 200, products);
  }),
);

// Popular products (sorted by highest rating)
router.get(
  "/popular",
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit) || 8;
    const products = await Product.find({ isActive: true, ratingCount: { $gt: 0 } })
      .sort({ averageRating: -1, ratingCount: -1 })
      .limit(limit)
      .lean();

    return response.success(res, "Popular products retrieved", 200, products);
  }),
);

router.get(
  "/filter",
  asyncHandler(async (req, res) => {
    const {
      page,
      limit,
      category,
      subCategory,
      design,
      priceMin,
      priceMax,
      rating,
      searchQuery,
      sort,
    } = req.query;

    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 8;
    const skip = (pageNumber - 1) * limitNumber;

    const searchTerm =
      typeof searchQuery === "string" ? searchQuery.trim() : "";

    const query: Record<string, any> = {
      ...(category && { category }),
      ...(subCategory && { subCategory }),
      ...(design && { design }),
      ...(rating && { averageRating: { $gte: Number(rating) } }),
      ...(priceMin || priceMax
        ? {
          price: {
            ...(priceMin && { $gte: Number(priceMin) }),
            ...(priceMax && { $lte: Number(priceMax) }),
          },
        }
        : {}),
      ...(searchTerm
        ? {
          $or: [
            { name: { $regex: searchTerm, $options: "i" } },
            { sku: { $regex: searchTerm, $options: "i" } },
            { category: { $regex: searchTerm, $options: "i" } },
            { subCategory: { $regex: searchTerm, $options: "i" } },
            { design: { $regex: searchTerm, $options: "i" } },
          ],
        }
        : {}),
    };

    const total = await Product.countDocuments(query);

    // Build sort object based on sort parameter (default: newest first)
    let sortObj: Record<string, 1 | -1> = { createdAt: -1 };
    switch (sort) {
      case "price-asc":
        sortObj = { price: 1 };
        break;
      case "price-desc":
        sortObj = { price: -1 };
        break;
      case "rating":
        sortObj = { averageRating: -1, ratingCount: -1 };
        break;
      case "newest":
      default:
        sortObj = { createdAt: -1 };
        break;
    }

    const products = await Product.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNumber)
      .lean();

    return response.success(res, "Products are successfully retrieved", 200, {
      products,
      total,
      page: pageNumber,
      limit: limitNumber,
    });
  }),
);

router.get(
  "/:productId",
  asyncHandler(async (req, res) => {
    const productId = req.params.productId;

    if (!productId) {
      return response.failure(res, "productId is invalid", 400);
    }

    const getProduct = await Product.findById(productId, {
      __v: 0,
      updatedAt: 0,
      createdAt: 0,
    }).lean();

    const getReview = await Review.find({ productId: productId })
      .populate("userId", "name email")
      .lean();

    if (!getProduct) {
      return response.failure(res, "Product not found", 404);
    }
    const formattedProduct = {
      ...getProduct,
      review: getReview,
    };

    return response.success(
      res,
      "Product is successfully retrieved",
      200,
      formattedProduct,
    );
  }),
);

export default router;
