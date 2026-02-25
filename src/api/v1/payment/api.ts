import express from "express";
import asyncHandler from "../../../utils/async-handler.js";
import checkCookies from "../../../utils/m-check-cookies.js";
import response from "../../../utils/response.js";
import Product from "../../../schema/product.js";
import Address from "../../../schema/address.js";
import razorpayInstance from "../../../libs/razorpay.js";
import Order from "../../../schema/order.js";
import OrderStatus from "../../../schema/orderStatus.js";
import { validateWebhookSignature } from "razorpay/dist/utils/razorpay-utils.js";
import AddToCart from "../../../schema/addtocart.js";

const router = express.Router();

// Create Razorpay order from cart
router.post(
  "/create",
  checkCookies,
  asyncHandler(async (req, res) => {
    const { amount, offer, name, email, addressId } = req.body;

    if (!addressId) {
      return response.failure(res, "Address is required", 400);
    }

    if (!amount || amount <= 0) {
      return response.failure(res, "Invalid amount", 400);
    }

    const isAddressExist = await Address.findOne({
      _id: addressId,
      userId: req?._id!,
    }).lean();

    if (!isAddressExist) {
      return response.failure(res, "Address not found", 404);
    }

    // Get user's cart with populated product info
    const userCart = await AddToCart.findOne({
      userId: req?._id!,
    })
      .populate("items.productId")
      .lean();

    if (!userCart || !userCart.items || userCart.items.length === 0) {
      return response.failure(res, "Cart is empty", 400);
    }

    // Build product summary for Razorpay notes
    const cartSummary = userCart.items.map((item: any) => ({
      productId: item.productId?._id,
      name: item.productId?.name,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      price: item.totalPrice,
    }));

    const createOrder = await razorpayInstance.orders.create({
      amount: amount * 100, // Razorpay expects amount in paise
      currency: "INR",
      receipt: `receipt_order_${Date.now()}`,
      notes: {
        name: name,
        products: JSON.stringify(cartSummary),
        email: email,
        offer: offer || "",
        address: addressId,
      },
    });

    // Save order to DB — associate with the first product for now
    // (multi-product orders can be enhanced later)
    const order = await Order.create({
      razorpayOrderId: createOrder.id,
      amount: amount,
      userId: req?._id!,
      productId: userCart.items[0]?.productId?._id || userCart.items[0]?.productId,
      status: createOrder.status,
      currency: createOrder.currency,
      receipt: createOrder.receipt!,
      notes: {
        name: name,
        products: cartSummary,
        email: email,
        offer: offer || "",
        address: addressId,
      },
    });

    return response.success(res, "Order created successfully", 201, {
      order,
      razorpayOrder: createOrder,
    });
  }),
);

// Verify payment after Razorpay callback
router.post(
  "/verify",
  checkCookies,
  asyncHandler(async (req, res) => {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return response.failure(res, "Missing payment details", 400);
    }

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const isValid = validateWebhookSignature(
      body,
      razorpay_signature,
      process.env.RAZORPAY_KEY_SECRET!,
    );

    if (!isValid) {
      return response.failure(res, "Payment verification failed", 400);
    }

    const order = await Order.findOneAndUpdate(
      {
        razorpayOrderId: razorpay_order_id,
        userId: req?._id!,
      },
      {
        $set: {
          paymentId: razorpay_payment_id,
          status: "paid",
        },
      },
      { new: true },
    );

    if (!order) {
      return response.failure(res, "Order not found", 404);
    }

    // Create order status entry
    await OrderStatus.create({
      orderId: order._id,
      status: "Order",
      description: "Order placed and payment received successfully",
      productId: order.productId,
      userId: req?._id!,
    });

    // Clear user's cart after successful payment
    await AddToCart.findOneAndDelete({ userId: req?._id! });

    return response.success(res, "Payment verified successfully", 200, {
      order,
    });
  }),
);

// Razorpay webhook (for async payment events)
router.post(
  "/webhook",
  asyncHandler(async (req, res) => {
    const webhookSignature = req.get("X-Razorpay-Signature")!;

    const isWebhookValid = validateWebhookSignature(
      JSON.stringify(req.body),
      webhookSignature,
      process.env.RAZORPAY_WEBHOOK_SECRET!,
    );

    if (!isWebhookValid) {
      return response.failure(res, "Invalid webhook signature", 400);
    }

    const paymentDetails = req.body.payload.payment.entity;

    if (req.body.event === "payment.captured") {
      // Update order status to paid
      const order = await Order.findOneAndUpdate(
        { razorpayOrderId: paymentDetails.order_id },
        { $set: { paymentId: paymentDetails.id, status: "paid" } },
        { new: true },
      );

      if (order) {
        await OrderStatus.create({
          orderId: order._id,
          status: "Order",
          description: "Payment captured successfully via webhook",
          productId: order.productId,
          userId: order.userId,
        });

        // Clear cart
        await AddToCart.findOneAndDelete({ userId: order.userId });
      }
    }

    if (req.body.event === "payment.failed") {
      await Order.findOneAndUpdate(
        { razorpayOrderId: paymentDetails.order_id },
        { $set: { status: "failed" } },
      );
    }

    return response.success(res, "Webhook received successfully", 200);
  }),
);

export default router;
