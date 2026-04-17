import express from "express";
import asyncHandler from "../../../utils/async-handler.js";
import checkCookies from "../../../utils/m-check-cookies.js";
import response from "../../../utils/response.js";
import { isAdminEmail } from "../../../routes.js";
import Order from "../../../schema/order.js";
import OrderStatus from "../../../schema/orderStatus.js";
import Product from "../../../schema/product.js";
import Coupon from "../../../schema/coupon.js";
import User from "../../../schema/user.js";

const router = express.Router();

function startOfCurrentMonthMonthsAgo(monthsBack: number) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - monthsBack);
    date.setHours(0, 0, 0, 0);
    return date;
}

router.get(
    "/dashboard/summary",
    checkCookies,
    asyncHandler(async (req, res) => {
        if (!req.email || !isAdminEmail.includes(req.email.toLowerCase())) {
            return response.failure(res, "Forbidden: Admins only", 403);
        }

        const sixMonthsAgo = startOfCurrentMonthMonthsAgo(5);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
        thirtyDaysAgo.setHours(0, 0, 0, 0);

        const [orderAggregation, deliveryAggregation, productAggregation, categoryAggregation, couponAggregation, userAggregation] =
            await Promise.all([
                Order.aggregate([
                    { $match: { status: "paid" } },
                    {
                        $facet: {
                            overview: [
                                {
                                    $group: {
                                        _id: null,
                                        totalOrders: { $sum: 1 },
                                        totalRevenue: { $sum: "$amount" },
                                        averageOrderValue: { $avg: "$amount" },
                                        customers: { $addToSet: "$userId" },
                                    },
                                },
                                {
                                    $project: {
                                        _id: 0,
                                        totalOrders: 1,
                                        totalRevenue: 1,
                                        averageOrderValue: 1,
                                        totalCustomers: { $size: "$customers" },
                                    },
                                },
                            ],
                            revenueTrend: [
                                { $match: { createdAt: { $gte: sixMonthsAgo } } },
                                {
                                    $group: {
                                        _id: {
                                            $dateToString: { format: "%Y-%m", date: "$createdAt" },
                                        },
                                        revenue: { $sum: "$amount" },
                                        orders: { $sum: 1 },
                                    },
                                },
                                { $sort: { _id: 1 } },
                            ],
                            recentOrders: [
                                { $sort: { createdAt: -1 } },
                                { $limit: 5 },
                                {
                                    $lookup: {
                                        from: "users",
                                        localField: "userId",
                                        foreignField: "_id",
                                        as: "user",
                                    },
                                },
                                {
                                    $lookup: {
                                        from: "products",
                                        localField: "productId",
                                        foreignField: "_id",
                                        as: "product",
                                    },
                                },
                                {
                                    $lookup: {
                                        from: "orderstatuses",
                                        let: { orderId: "$_id" },
                                        pipeline: [
                                            {
                                                $match: {
                                                    $expr: { $eq: ["$orderId", "$$orderId"] },
                                                },
                                            },
                                            { $sort: { createdAt: -1 } },
                                            { $limit: 1 },
                                        ],
                                        as: "latestStatusDoc",
                                    },
                                },
                                {
                                    $project: {
                                        _id: 1,
                                        receipt: 1,
                                        amount: 1,
                                        currency: 1,
                                        createdAt: 1,
                                        paymentId: 1,
                                        latestStatus: {
                                            $ifNull: [
                                                { $arrayElemAt: ["$latestStatusDoc.status", 0] },
                                                "Order",
                                            ],
                                        },
                                        userId: {
                                            $let: {
                                                vars: { user: { $arrayElemAt: ["$user", 0] } },
                                                in: {
                                                    name: "$$user.name",
                                                    email: "$$user.email",
                                                },
                                            },
                                        },
                                        productId: {
                                            $let: {
                                                vars: { product: { $arrayElemAt: ["$product", 0] } },
                                                in: {
                                                    name: "$$product.name",
                                                    sku: "$$product.sku",
                                                },
                                            },
                                        },
                                    },
                                },
                            ],
                            topProducts: [
                                {
                                    $group: {
                                        _id: "$productId",
                                        orders: { $sum: 1 },
                                        revenue: { $sum: "$amount" },
                                    },
                                },
                                { $sort: { orders: -1 } },
                                { $limit: 5 },
                                {
                                    $lookup: {
                                        from: "products",
                                        localField: "_id",
                                        foreignField: "_id",
                                        as: "product",
                                    },
                                },
                                {
                                    $project: {
                                        _id: 1,
                                        orders: 1,
                                        revenue: 1,
                                        name: {
                                            $let: {
                                                vars: { product: { $arrayElemAt: ["$product", 0] } },
                                                in: "$$product.name",
                                            },
                                        },
                                        sku: {
                                            $let: {
                                                vars: { product: { $arrayElemAt: ["$product", 0] } },
                                                in: "$$product.sku",
                                            },
                                        },
                                        category: {
                                            $let: {
                                                vars: { product: { $arrayElemAt: ["$product", 0] } },
                                                in: "$$product.category",
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                    },
                ]),
                OrderStatus.aggregate([
                    { $sort: { createdAt: 1 } },
                    {
                        $group: {
                            _id: "$orderId",
                            status: { $last: "$status" },
                        },
                    },
                    {
                        $group: {
                            _id: "$status",
                            count: { $sum: 1 },
                        },
                    },
                    {
                        $project: {
                            _id: 0,
                            status: "$_id",
                            count: 1,
                        },
                    },
                    { $sort: { count: -1 } },
                ]),
                Product.aggregate([
                    {
                        $group: {
                            _id: null,
                            totalProducts: { $sum: 1 },
                            activeProducts: {
                                $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 0,
                            totalProducts: 1,
                            activeProducts: 1,
                        },
                    },
                ]),
                Product.aggregate([
                    {
                        $group: {
                            _id: "$category",
                            total: { $sum: 1 },
                            active: {
                                $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
                            },
                        },
                    },
                    { $sort: { total: -1 } },
                ]),
                Coupon.aggregate([
                    {
                        $group: {
                            _id: null,
                            totalCoupons: { $sum: 1 },
                            activeCoupons: {
                                $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 0,
                            totalCoupons: 1,
                            activeCoupons: 1,
                        },
                    },
                ]),
                User.aggregate([
                    {
                        $group: {
                            _id: null,
                            totalUsers: { $sum: 1 },
                            newUsers30d: {
                                $sum: { $cond: [{ $gte: ["$createdAt", thirtyDaysAgo] }, 1, 0] },
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 0,
                            totalUsers: 1,
                            newUsers30d: 1,
                        },
                    },
                ]),
            ]);

        const overview = orderAggregation?.[0]?.overview?.[0] ?? {};
        const revenueTrend = orderAggregation?.[0]?.revenueTrend ?? [];
        const recentOrders = orderAggregation?.[0]?.recentOrders ?? [];
        const topProducts = orderAggregation?.[0]?.topProducts ?? [];
        const deliveryBreakdown = deliveryAggregation ?? [];
        const productSummary = productAggregation?.[0] ?? { totalProducts: 0, activeProducts: 0 };
        const categoryBreakdown = categoryAggregation ?? [];
        const couponSummary = couponAggregation?.[0] ?? { totalCoupons: 0, activeCoupons: 0 };
        const userSummary = userAggregation?.[0] ?? { totalUsers: 0, newUsers30d: 0 };

        return response.success(res, "Dashboard summary fetched successfully", 200, {
            overview: {
                totalOrders: overview.totalOrders ?? 0,
                totalRevenue: overview.totalRevenue ?? 0,
                averageOrderValue: overview.averageOrderValue ?? 0,
                totalCustomers: overview.totalCustomers ?? 0,
                totalUsers: userSummary.totalUsers ?? 0,
                newUsers30d: userSummary.newUsers30d ?? 0,
                totalProducts: productSummary.totalProducts ?? 0,
                activeProducts: productSummary.activeProducts ?? 0,
                totalCategories: categoryBreakdown.length ?? 0,
                totalCoupons: couponSummary.totalCoupons ?? 0,
                activeCoupons: couponSummary.activeCoupons ?? 0,
            },
            revenueTrend: revenueTrend.map((item: any) => ({
                label: item._id,
                revenue: item.revenue ?? 0,
                orders: item.orders ?? 0,
            })),
            deliveryBreakdown: deliveryBreakdown.map((item: any) => ({
                status: item.status,
                count: item.count ?? 0,
            })),
            categoryBreakdown: categoryBreakdown.map((item: any) => ({
                category: item._id,
                total: item.total ?? 0,
                active: item.active ?? 0,
            })),
            topProducts: topProducts.map((item: any) => ({
                id: String(item._id),
                name: item.name || "Product",
                sku: item.sku || "-",
                category: item.category || "-",
                orders: item.orders ?? 0,
                revenue: item.revenue ?? 0,
            })),
            recentOrders: recentOrders.map((item: any) => ({
                id: String(item._id),
                receipt: item.receipt || "-",
                amount: item.amount ?? 0,
                currency: item.currency || "INR",
                createdAt: item.createdAt,
                latestStatus: item.latestStatus || "Order",
                user: item.userId ?? {},
                product: item.productId ?? {},
            })),
        });
    }),
);

export default router;