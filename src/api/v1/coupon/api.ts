import express from "express";
import asyncHandler from "../../../utils/async-handler.js";
import response from "../../../utils/response.js";
import Coupon from "../../../schema/coupon.js";
import checkCookies from "../../../utils/m-check-cookies.js";
import Product from "../../../schema/product.js";

const router = express.Router();

router.post(
  "/code/apply",
  asyncHandler(async (req, res) => {
    const { code, orderValue, productIds } = req.body;

    if (!code || !orderValue || !Array.isArray(productIds)) {
      return response.failure(
        res,
        "Code, order value, and product IDs are required",
        400,
      );
    }

    const currentDate = new Date();

    const coupon = await Coupon.findOne({
      code: code.toString().toUpperCase(),
      validFrom: { $lte: currentDate },
      validTill: { $gte: currentDate },
      $expr: { $lt: ["$usedCount", "$usageLimit"] },
    })
      .populate("applicableTo")
      .lean();

    if (!coupon) {
      return response.failure(res, "Invalid or expired coupon", 404);
    }

    if (coupon.minOrderValue && Number(orderValue) < coupon.minOrderValue) {
      return response.failure(
        res,
        `Order value must be at least ${coupon.minOrderValue}`,
        400,
      );
    }

    // ---------- COUNT QUANTITY ----------
    const quantityMap = productIds.reduce(
      (acc: Record<string, number>, p: any) => {
        const id = p._id.toString();
        acc[id] = (acc[id] || 0) + 1;
        return acc;
      },
      {},
    );

    const productIdsUnique = Object.keys(quantityMap);

    // ---------- FIND APPLICABLE PRODUCT IDS ----------
    const applicableIdSet = new Set(
      coupon.applicableTo.map((p: any) => p._id.toString()),
    );

    const discountedOnceIds = productIdsUnique.filter((id) =>
      applicableIdSet.has(id),
    );

    if (discountedOnceIds.length === 0) {
      return response.failure(
        res,
        "Coupon is not applicable to selected products",
        400,
      );
    }

    // ---------- FETCH PRODUCTS ----------
    const products = await Product.find({
      _id: { $in: productIdsUnique },
    }).lean();

    let totalAmount = 0;
    const discountProducts: any[] = [];

    for (const product of products) {
      const id = product._id.toString();
      const qty = quantityMap[id];

      // Apply discount to ALL units of applicable products
      if (discountedOnceIds.includes(id)) {
        const discountedPrice =
          product.price - (product.price * coupon.discount) / 100;

        totalAmount += discountedPrice * qty;

        discountProducts.push({
          ...product,
          quantity: qty,
          discountedPrice: Math.round(discountedPrice),
          totalSavings: Math.round((product.price - discountedPrice) * qty),
        });
      } else {
        totalAmount += product.price * qty;
      }
    }

    totalAmount = Math.round(totalAmount);

    await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } });

    return response.success(res, "Coupon applied successfully", 200, {
      code: coupon.code,
      offer: `${coupon.discount}% off`,
      discountProducts,
      amount: totalAmount,
    });
  }),
);

export default router;
