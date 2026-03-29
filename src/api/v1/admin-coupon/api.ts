import express from "express";
import asyncHandler from "../../../utils/async-handler.js";
import response from "../../../utils/response.js";
import checkCookies from "../../../utils/m-check-cookies.js";
import InputSensitization from "../../../utils/m-input-sensitization.js";
import Product from "../../../schema/product.js";
import Coupon from "../../../schema/coupon.js";
import mongoose from "mongoose";

const router = express.Router();

type CouponPayload = {
  code?: string;
  discount?: number;
  minOrderValue?: number;
  usageLimit?: number;
  validFrom?: string;
  validTill?: string;
  isActive?: boolean;
  applicableTo?: string[];
};

function parseNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function normalizeCouponPayload(
  payload: CouponPayload,
  options: { partial?: boolean } = {},
) {
  const partial = options.partial ?? false;
  const normalized: CouponPayload = {};

  const hasField = (key: keyof CouponPayload) =>
    payload[key] !== undefined && payload[key] !== null;

  if (!partial || hasField("code")) {
    const code = String(payload.code ?? "").trim().toUpperCase();
    if (!code) {
      return { error: "Coupon code is required" };
    }
    normalized.code = code;
  }

  if (!partial || hasField("discount")) {
    const discount = parseNumber(payload.discount);
    if (!Number.isFinite(discount)) {
      return { error: "Discount must be a valid number" };
    }
    if (discount < 0 || discount > 100) {
      return { error: "Discount must be between 0 and 100" };
    }
    normalized.discount = Number(discount.toFixed(2));
  }

  if (!partial || hasField("minOrderValue")) {
    const minOrderValue = parseNumber(payload.minOrderValue);
    if (!Number.isFinite(minOrderValue)) {
      return { error: "Minimum order value must be a valid number" };
    }
    if (minOrderValue < 0) {
      return { error: "Minimum order value cannot be negative" };
    }
    normalized.minOrderValue = minOrderValue;
  }

  if (!partial || hasField("usageLimit")) {
    const usageLimit = parseNumber(payload.usageLimit);
    if (!Number.isFinite(usageLimit) || !Number.isInteger(usageLimit)) {
      return { error: "Usage limit must be an integer" };
    }
    if (usageLimit < 1) {
      return { error: "Usage limit must be at least 1" };
    }
    normalized.usageLimit = usageLimit;
  }

  if (!partial || hasField("validFrom")) {
    const validFrom = new Date(String(payload.validFrom));
    if (Number.isNaN(validFrom.getTime())) {
      return { error: "Valid from date is invalid" };
    }
    normalized.validFrom = validFrom.toISOString();
  }

  if (!partial || hasField("validTill")) {
    const validTill = new Date(String(payload.validTill));
    if (Number.isNaN(validTill.getTime())) {
      return { error: "Valid till date is invalid" };
    }
    normalized.validTill = validTill.toISOString();
  }

  if (normalized.validFrom && normalized.validTill) {
    if (new Date(normalized.validTill) < new Date(normalized.validFrom)) {
      return { error: "Valid till date must be after valid from date" };
    }
  }

  if (!partial || hasField("isActive")) {
    if (typeof payload.isActive !== "boolean") {
      return { error: "Active flag must be true or false" };
    }
    normalized.isActive = payload.isActive;
  }

  if (!partial || hasField("applicableTo")) {
    if (!Array.isArray(payload.applicableTo)) {
      return { error: "Applicable products must be an array" };
    }
    const hasInvalidProductId = payload.applicableTo.some(
      (id) => !mongoose.Types.ObjectId.isValid(id),
    );
    if (hasInvalidProductId) {
      return { error: "One or more product IDs are invalid" };
    }
    normalized.applicableTo = payload.applicableTo;
  }

  return { data: normalized };
}

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
    const normalizedPayloadResult = normalizeCouponPayload(req.body);
    if (normalizedPayloadResult.error) {
      return response.failure(res, normalizedPayloadResult.error, 400);
    }

    const {
      code,
      discount,
      minOrderValue,
      usageLimit,
      validFrom,
      validTill,
      isActive,
      applicableTo = [],
    } = normalizedPayloadResult.data!;

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
      validFrom,
      validTill,
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

    const normalizedPayloadResult = normalizeCouponPayload(req.body, {
      partial: true,
    });
    if (normalizedPayloadResult.error) {
      return response.failure(res, normalizedPayloadResult.error, 400);
    }

    const payload = normalizedPayloadResult.data!;

    if (payload.applicableTo) {
      const productExists = await Product.find({
        _id: {
          $in: payload.applicableTo.map(
            (id: string) => new mongoose.Types.ObjectId(id),
          ),
        },
      });

      if (productExists.length !== payload.applicableTo.length) {
        return response.failure(res, "Applicable product does not exist", 400);
      }
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(
      couponId,
      { $set: payload },
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
