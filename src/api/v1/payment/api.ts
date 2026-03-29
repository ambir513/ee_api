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
import { sendEmail } from "../../../libs/brevo.js";
import { log } from "../../../utils/logger.js";

const router = express.Router();

function formatCurrency(value: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

function getPrimaryAdminEmail() {
  const adminList = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return adminList[0] || null;
}

function getCustomerFromOrder(order: any) {
  const name =
    (order?.notes?.name as string) ||
    (typeof order?.userId === "object" && order?.userId?.name) ||
    "Customer";

  const email =
    (order?.notes?.email as string) ||
    (typeof order?.userId === "object" && order?.userId?.email) ||
    "";

  return { name, email };
}

function buildAdminOrderEmail(order: any) {
  const customer = getCustomerFromOrder(order);
  const amount = formatCurrency(order.amount, order.currency || "INR");

  return {
    subject: `New Order Received - ${order.receipt}`,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; color: #222; line-height: 1.6;">
        <h2 style="margin: 0 0 12px;">New Order Alert</h2>
        <p style="margin: 0 0 12px;">A new order has been paid successfully.</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 560px;">
          <tr><td style="padding: 6px 0; font-weight: 600;">Order ID:</td><td style="padding: 6px 0;">${order._id}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Receipt:</td><td style="padding: 6px 0;">${order.receipt}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Amount:</td><td style="padding: 6px 0;">${amount}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Customer:</td><td style="padding: 6px 0;">${customer.name}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Email:</td><td style="padding: 6px 0;">${customer.email || "N/A"}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Payment ID:</td><td style="padding: 6px 0;">${order.paymentId || "N/A"}</td></tr>
        </table>
      </div>
    `,
  };
}

function buildCustomerOrderEmail(order: any) {
  const customer = getCustomerFromOrder(order);
  const amount = formatCurrency(order.amount, order.currency || "INR");

  return {
    to: customer,
    subject: `Thank you for your order - ${order.receipt}`,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; color: #222; line-height: 1.6;">
        <h2 style="margin: 0 0 12px;">Thank You For Your Order</h2>
        <p style="margin: 0 0 12px;">Hi ${customer.name},</p>
        <p style="margin: 0 0 12px;">We have received your payment and your order is confirmed.</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 560px;">
          <tr><td style="padding: 6px 0; font-weight: 600;">Receipt:</td><td style="padding: 6px 0;">${order.receipt}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Amount Paid:</td><td style="padding: 6px 0;">${amount}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Payment ID:</td><td style="padding: 6px 0;">${order.paymentId || "N/A"}</td></tr>
        </table>
        <p style="margin: 14px 0 0;">Our team will start processing your order shortly.</p>
        <p style="margin: 8px 0 0;">Regards,<br />Ethnic Elegance Team</p>
      </div>
    `,
  };
}

async function sendOrderSuccessEmails(order: any) {
  const adminEmail = getPrimaryAdminEmail();
  const customerMail = buildCustomerOrderEmail(order);

  const tasks: Promise<any>[] = [];

  if (adminEmail) {
    const adminMail = buildAdminOrderEmail(order);
    tasks.push(
      sendEmail({
        subject: adminMail.subject,
        htmlContent: adminMail.htmlContent,
        to: { email: adminEmail, name: "Admin" },
      }),
    );
  }

  if (customerMail.to.email) {
    tasks.push(
      sendEmail({
        subject: customerMail.subject,
        htmlContent: customerMail.htmlContent,
        to: {
          email: customerMail.to.email,
          name: customerMail.to.name,
        },
      }),
    );
  }

  if (tasks.length === 0) return;

  const results = await Promise.allSettled(tasks);
  results.forEach((result) => {
    if (result.status === "rejected") {
      log(`Order email failed: ${String(result.reason)}`, "error");
    }
  });
}

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

    // Some users may have duplicate cart documents; pick the latest non-empty cart.
    const userCarts = await AddToCart.find({
      userId: req?._id!,
    })
      .populate("items.productId")
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    const userCart = userCarts.find(
      (cart: any) => Array.isArray(cart?.items) && cart.items.length > 0,
    );

    if (!userCart) {
      return response.failure(res, "Cart is empty", 400);
    }

    const validItems = userCart.items.filter((item: any) => {
      return (
        item?.productId &&
        (item.quantity ?? 0) > 0 &&
        (item.totalPrice ?? 0) > 0
      );
    });

    if (validItems.length === 0) {
      return response.failure(res, "Cart is empty", 400);
    }

    // Build product summary for Razorpay notes
    const cartSummary = validItems.map((item: any) => ({
      productId: item.productId?._id,
      name: item.productId?.name,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      price: item.totalPrice,
    }));

    const createOrder = await razorpayInstance.orders.create({
      amount: Math.round(amount * 100), // Razorpay expects integer paise
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
      productId: (validItems[0]?.productId as any)?._id || validItems[0]?.productId,
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
      keyId: process.env.RAZORPAY_KEY_ID,
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

    const existingOrder = await Order.findOne({
      razorpayOrderId: razorpay_order_id,
      userId: req?._id!,
    });

    if (!existingOrder) {
      return response.failure(res, "Order not found", 404);
    }

    // Idempotent verify: if already paid, do not duplicate status entries/emails.
    if (existingOrder.status === "paid") {
      return response.success(res, "Payment already verified", 200, {
        order: existingOrder,
      });
    }

    existingOrder.paymentId = razorpay_payment_id;
    existingOrder.status = "paid";
    await existingOrder.save();

    const order = existingOrder;

    // Create order status entry if not present
    const existingOrderStatus = await OrderStatus.findOne({
      orderId: order._id,
      status: "Order",
    }).lean();

    if (!existingOrderStatus) {
      await OrderStatus.create({
        orderId: order._id,
        status: "Order",
        description: "Order placed and payment received successfully",
        productId: order.productId,
        userId: req?._id!,
      });
    }

    // Clear all user cart docs after successful payment (handles duplicate cart docs).
    await AddToCart.deleteMany({ userId: req?._id! });

    await sendOrderSuccessEmails(order);

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
      const existingOrder = await Order.findOne({
        razorpayOrderId: paymentDetails.order_id,
      });

      if (!existingOrder) {
        return response.success(res, "Webhook received successfully", 200);
      }

      // Idempotent webhook: skip duplicates for already paid orders.
      if (existingOrder.status === "paid") {
        return response.success(res, "Webhook received successfully", 200);
      }

      existingOrder.paymentId = paymentDetails.id;
      existingOrder.status = "paid";
      await existingOrder.save();

      const order = existingOrder;

      if (order) {
        const existingOrderStatus = await OrderStatus.findOne({
          orderId: order._id,
          status: "Order",
        }).lean();

        if (!existingOrderStatus) {
          await OrderStatus.create({
            orderId: order._id,
            status: "Order",
            description: "Payment captured successfully via webhook",
            productId: order.productId,
            userId: order.userId,
          });
        }

        // Clear all cart docs for this user
        await AddToCart.deleteMany({ userId: order.userId });

        await sendOrderSuccessEmails(order);
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
