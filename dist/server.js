import "./libs/dotenv.js";
import express from "express";
import response from "./utils/response.js";
import connectDB from "./libs/mongoose.js";
import { log } from "./utils/logger.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./api/v1/auth/api.js";
import adminProductRouter from "./api/v1/admin-product/api.js";
import signatureRouter from "./signature.route.js";
import checkCookies from "./utils/m-check-cookies.js";
import adminCouponRouter from "./api/v1/admin-coupon/api.js";
import couponCodeRouter from "./api/v1/coupon/api.js";
import accountRouter from "./api/v1/account/api.js";
import ProductRouter from "./api/v1/product/api.js";
import addToCartRouter from "./api/v1/addtocart/api.js";
import watchlistRouter from "./api/v1/watchlist/api.js";
import paymentRouter from "./api/v1/payment/api.js";
import reviewRouter from "./api/v1/review/api.js";
const app = express();
const PORT = process.env.PORT || 5001;
const url = process.env.FRONTEND_URL || "http://localhost:3000";
app.use(cors({
    origin: [url],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/account", accountRouter);
app.use("/api/v1/product", ProductRouter);
app.use("/api/v1/admin", adminProductRouter);
app.use("/api/v1/admin", adminCouponRouter);
app.use("/api/v1/coupon", couponCodeRouter);
app.use("/api/v1/cloudinary", checkCookies, signatureRouter);
app.use("/api/v1/addtocart", addToCartRouter);
app.use("/api/v1/watchlist", watchlistRouter);
app.use("/api/v1/payment", paymentRouter);
app.use("/api/v1/review", reviewRouter);
app.get("/", (req, res) => {
    return response.success(res, "Hello World", 200);
});
app.use((err, req, res, next) => {
    return response.failure(res, err.message, 500);
});
connectDB().then(() => {
    app.listen(PORT, () => {
        log(`Running - http://localhost:${PORT}`, "success");
    });
});
