import express from "express";
import asyncHandler from "../../../utils/async-handler.js";
import response from "../../../utils/response.js";
import checkCookies from "../../../utils/m-check-cookies.js";
import InputSensitization from "../../../utils/m-input-sensitization.js";
import Product from "../../../schema/product.js";
import Coupon from "../../../schema/coupon.js";
import mongoose from "mongoose";

const router = express.Router();

// List all coupons (admin)
router.get(
  "/coupons/list",
  checkCookies,
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query;
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 20;
    const skip = (pageNumber - 1) * limitNumber;

    const coupons = await Coupon.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean();

    const total = await Coupon.countDocuments();

    return response.success(res, "Coupons retrieved successfully", 200, {
      coupons,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  }),
);

router.get(
  "/coupon/:couponId",
  checkCookies,
  asyncHandler(async (req, res) => {
    const couponId = req.params.couponId;

    if (!couponId) {
      return response.failure(res, "Coupon ID is required", 400);
    }

    const coupon = await Coupon.findById(couponId).lean();

    if (!coupon) {
      return response.failure(res, "Coupon not found", 404);
    }

    return response.success(res, "Coupon retrieved successfully", 200, coupon);
  }),
);

router.post(
  "/coupon/create",
  checkCookies,
  InputSensitization,
  asyncHandler(async (req, res) => {
    const {
      code,
      discount,
      minOrderValue,
      usageLimit,
      validFrom,
      validTill,
      isActive,
      applicableTo,
    } = req.body;

    const productExists = await Product.find({
      _id: {
        $in: applicableTo.map((id: string) => new mongoose.Types.ObjectId(id)),
      },
    });

    if (productExists.length !== applicableTo.length) {
      return response.failure(res, "Applicable product does not exist", 400);
    }

    const newCoupon = await Coupon.create({
      code,
      discount,
      minOrderValue,
      usageLimit,
      isActive,
      validFrom: new Date(validFrom).toISOString(),
      validTill: new Date(validTill).toISOString(),
      applicableTo,
    });

    return response.success(res, "Coupon created successfully", 201, newCoupon);
  }),
);

router.patch(
  "/coupon/edit/:couponId",
  checkCookies,
  InputSensitization,
  asyncHandler(async (req, res) => {
    const couponId = req.params.couponId;

    if (!couponId) {
      return response.failure(res, "Coupon ID is required", 400);
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(
      couponId,
      { $set: req.body },
      { new: true },
    ).lean();

    if (!updatedCoupon) {
      return response.failure(res, "Coupon not found", 404);
    }

    return response.success(
      res,
      "Coupon updated successfully",
      200,
      updatedCoupon,
    );
  }),
);

router.delete(
  "/coupon/delete/:couponId",
  checkCookies,
  asyncHandler(async (req, res) => {
    const couponId = req.params.couponId;

    if (!couponId) {
      return response.failure(res, "Coupon ID is required", 400);
    }

    const deletedCoupon = await Coupon.findByIdAndDelete(couponId).lean();

    if (!deletedCoupon) {
      return response.failure(res, "Coupon not found", 404);
    }

    return response.success(
      res,
      "Coupon deleted successfully",
      200,
      deletedCoupon,
    );
  }),
);

router.get(
  "/coupons/apply",
  //   checkCookies,
  asyncHandler(async (req, res) => {
    const { code, orderValue, productId } = req.query;
    if (!code || !orderValue || !productId) {
      return response.failure(
        res,
        "Code, order value, and product ID are required",
        400,
      );
    }

    const coupon = await Coupon.findOne({ code: code.toString() })
      .populate("Product")
      .lean();

    if (!coupon) {
      return response.failure(res, "Invalid coupon code", 404);
    }

    const currentDate = new Date();

    if (
      currentDate < new Date(coupon.validFrom) ||
      currentDate > new Date(coupon.validTill)
    ) {
      return response.failure(res, "Coupon is not valid at this time", 400);
    }
    return response.success(res, "", 200, coupon);
  }),
);
export default router;
