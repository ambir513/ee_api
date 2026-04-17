import express from "express";
import asyncHandler from "../../../utils/async-handler.js";
import checkCookies from "../../../utils/m-check-cookies.js";
import response from "../../../utils/response.js";
import Order from "../../../schema/order.js";
import OrderStatus from "../../../schema/orderStatus.js";
import Product from "../../../schema/product.js";
import Address from "../../../schema/address.js";
import { isAdminEmail } from "../../../routes.js";

const router = express.Router();

// Get all orders for the logged-in user (with populated product + address + status history)
router.get(
    "/my-orders",
    checkCookies,
    asyncHandler(async (req, res) => {
        const orders = await Order.find({
            userId: req._id,
            status: "paid", // only show paid orders
        })
            .populate("productId", "name price mrp variants category subCategory sku")
            .populate("notes.address", "label addressLine1 addressLine2 addressLine3 city state pinCode phoneNo")
            .sort({ createdAt: -1 })
            .lean();

        // Attach status history to each order
        const ordersWithStatus = await Promise.all(
            orders.map(async (order) => {
                const statusHistory = await OrderStatus.find({
                    orderId: order._id,
                })
                    .sort({ createdAt: 1 })
                    .lean();

                return {
                    ...order,
                    statusHistory,
                };
            }),
        );

        return response.success(
            res,
            "Orders fetched successfully",
            200,
            ordersWithStatus,
        );
    }),
);

// Get single order details (with full status timeline)
router.get(
    "/track/:orderId",
    checkCookies,
    asyncHandler(async (req, res) => {
        const { orderId } = req.params;

        if (!orderId) {
            return response.failure(res, "Order ID is required", 400);
        }

        const order = await Order.findOne({
            _id: orderId,
            userId: req._id,
        })
            .populate("productId", "name price mrp variants category subCategory sku")
            .populate("notes.address", "label addressLine1 addressLine2 addressLine3 city state pinCode phoneNo")
            .lean();

        if (!order) {
            return response.failure(res, "Order not found", 404);
        }

        const statusHistory = await OrderStatus.find({
            orderId: order._id,
        })
            .sort({ createdAt: 1 })
            .lean();

        return response.success(res, "Order tracked successfully", 200, {
            ...order,
            statusHistory,
        });
    }),
);

// Admin: Get all orders (for admin order management)
router.get(
    "/admin/all",
    checkCookies,
    asyncHandler(async (req, res) => {
        // Check if admin
        if (!req.email || !isAdminEmail.includes(req.email.toLowerCase())) {
            return response.failure(res, "Forbidden: Admins only", 403);
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const statusFilter = req.query.status as string;
        const skip = (page - 1) * limit;

        const query: any = { status: "paid" };
        if (statusFilter && statusFilter !== "all") {
            // We need to find orders whose latest OrderStatus matches
        }

        const orders = await Order.find(query)
            .populate("productId", "name price mrp variants category subCategory sku")
            .populate("userId", "name email")
            .populate("notes.address", "label addressLine1 addressLine2 addressLine3 city state pinCode phoneNo")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await Order.countDocuments(query);

        // Attach latest status to each order
        const ordersWithStatus = await Promise.all(
            orders.map(async (order) => {
                const statusHistory = await OrderStatus.find({
                    orderId: order._id,
                })
                    .sort({ createdAt: 1 })
                    .lean();

                const latestStatus =
                    statusHistory.length > 0
                        ? statusHistory[statusHistory.length - 1]
                        : null;

                return {
                    ...order,
                    statusHistory,
                    latestStatus: latestStatus?.status || "Order",
                };
            }),
        );

        return response.success(res, "All orders fetched", 200, {
            orders: ordersWithStatus,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    }),
);

// Admin: Update order status (add new status entry to timeline)
router.post(
    "/admin/update-status",
    checkCookies,
    asyncHandler(async (req, res) => {
        // Check if admin
        if (!req.email || !isAdminEmail.includes(req.email.toLowerCase())) {
            return response.failure(res, "Forbidden: Admins only", 403);
        }

        const { orderId, status, description } = req.body;

        if (!orderId || !status) {
            return response.failure(res, "Order ID and status are required", 400);
        }

        const validStatuses = [
            "Order",
            "Shipped",
            "Out of Delivery",
            "Delivered",
            "Cancelled",
        ];
        if (!validStatuses.includes(status)) {
            return response.failure(
                res,
                `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
                400,
            );
        }

        const order = await Order.findById(orderId).lean();
        if (!order) {
            return response.failure(res, "Order not found", 404);
        }

        // Check if this status already exists
        const existingStatus = await OrderStatus.findOne({
            orderId,
            status,
        }).lean();

        if (existingStatus) {
            return response.failure(
                res,
                `Status "${status}" already exists for this order`,
                400,
            );
        }

        // Create the new status entry
        const statusDescriptions: Record<string, string> = {
            Order: "Order placed and payment received successfully",
            Shipped: "Your order has been shipped and is on its way",
            "Out of Delivery": "Your order is out for delivery",
            Delivered: "Your order has been delivered successfully",
            Cancelled: "Your order has been cancelled",
        };

        const newStatus = await OrderStatus.create({
            orderId,
            status,
            description: description || statusDescriptions[status] || `Order ${status}`,
            productId: order.productId,
            userId: order.userId,
        });

        return response.success(res, "Order status updated", 200, newStatus);
    }),
);

// Admin: Edit the latest order status entry
router.patch(
    "/admin/update-status/:orderId",
    checkCookies,
    asyncHandler(async (req, res) => {
        if (!req.email || !isAdminEmail.includes(req.email.toLowerCase())) {
            return response.failure(res, "Forbidden: Admins only", 403);
        }

        const { orderId } = req.params;
        const { status, description } = req.body;

        if (!orderId || !status) {
            return response.failure(res, "Order ID and status are required", 400);
        }

        const validStatuses = [
            "Order",
            "Shipped",
            "Out of Delivery",
            "Delivered",
            "Cancelled",
        ];

        if (!validStatuses.includes(status)) {
            return response.failure(
                res,
                `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
                400,
            );
        }

        const order = await Order.findById(orderId).lean();
        if (!order) {
            return response.failure(res, "Order not found", 404);
        }

        const statusDescriptions: Record<string, string> = {
            Order: "Order placed and payment received successfully",
            Shipped: "Your order has been shipped and is on its way",
            "Out of Delivery": "Your order is out for delivery",
            Delivered: "Your order has been delivered successfully",
            Cancelled: "Your order has been cancelled",
        };

        const latestStatusEntry = await OrderStatus.findOne({ orderId }).sort({ createdAt: -1 });

        if (!latestStatusEntry) {
            const createdStatus = await OrderStatus.create({
                orderId,
                status,
                description: description || statusDescriptions[status] || `Order ${status}`,
                productId: order.productId,
                userId: order.userId,
            });

            return response.success(res, "Order status created", 200, createdStatus);
        }

        latestStatusEntry.status = status;
        latestStatusEntry.description = description || statusDescriptions[status] || `Order ${status}`;
        await latestStatusEntry.save();

        return response.success(res, "Order status updated", 200, latestStatusEntry);
    }),
);

// Admin: Delete an order and its status history
router.delete(
    "/admin/delete/:orderId",
    checkCookies,
    asyncHandler(async (req, res) => {
        if (!req.email || !isAdminEmail.includes(req.email.toLowerCase())) {
            return response.failure(res, "Forbidden: Admins only", 403);
        }

        const { orderId } = req.params;

        if (!orderId) {
            return response.failure(res, "Order ID is required", 400);
        }

        const order = await Order.findById(orderId).lean();

        if (!order) {
            return response.failure(res, "Order not found", 404);
        }

        await Promise.all([
            OrderStatus.deleteMany({ orderId }),
            Order.findByIdAndDelete(orderId),
        ]);

        return response.success(res, "Order deleted successfully", 200, {
            deletedOrderId: orderId,
        });
    }),
);

export default router;
