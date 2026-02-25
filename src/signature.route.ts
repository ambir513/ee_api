import e from "express";
import express from "express";
import asyncHandler from "./utils/async-handler.js";
import { v2 as cloudinary } from "cloudinary";
import response from "./utils/response.js";
import checkCookies from "./utils/m-check-cookies.js";

const router = express.Router();

router.get(
  "/signature",
  checkCookies,
  asyncHandler(async (req, res) => {
    const timestamp = Math.round(Date.now() / 1000);
    const folder = (req.query.folder as string) || "products";

    // Validate folder parameter
    const allowedFolders = ["products", "avatars"];
    if (!allowedFolders.includes(folder)) {
      return response.failure(res, "Invalid folder parameter", 400);
    }

    const paramsToSign = {
      folder,
      timestamp,
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET as string,
    );

    return response.success(res, "Signature generated successfully", 200, {
      timestamp,
      signature,
      folder,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
    });
  }),
);

export default router;
