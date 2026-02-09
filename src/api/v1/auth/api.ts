import express from "express";
import asyncHandler from "../../../utils/async-handler.js";
import response from "../../../utils/response.js";
import InputSensitization from "../../../utils/m-input-sensitization.js";
import User from "../../../schema/user.js";
import generateOTP from "../../../utils/generate-otp.js";

import { createAuthToken } from "./utils.js";
import checkCookies from "../../../utils/m-check-cookies.js";
import clearOTP from "../../../utils/clear-otp.js";
import { isAdminEmail } from "../../../routes.js";
import { sendEmail } from "../../../libs/brevo.js";
import OTP from "../../../schema/otp.js";

const router = express.Router();

// Sign Up
router.post(
  "/sign-up",
  checkCookies,
  InputSensitization,
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    const isAlreadySendOtp = await OTP.checkOTP("auth", email);

    if (isAlreadySendOtp.status) {
      return response.failure(res, isAlreadySendOtp.message, 400);
    }

    const exists = await User.isUserExists(email);

    if (exists) {
      return response.failure(res, "User already exists", 400);
    }

    const { otp, otpSession } = await generateOTP(
      "auth",
      {
        name,
        email,
        password,
        role: isAdminEmail.includes(email.toLowerCase()) ? "ADMIN" : "USER",
      },
      2,
    );

    // send OTP via email logic goes here (omitted for brevity)
    const message = await sendEmail({
      subject: "Your OTP Code",
      htmlContent: `<p>Your OTP code is: <strong>${otp}</strong></p>`,
      to: { email, name },
    });

    console.log("Brevo OTP email response:", message);

    if (!otpSession) {
      return response.failure(res, "Failed to generate OTP", 500);
    }

    return response.success(res, "OTP sent successfully", 200, { otp });
  }),
);

// Verify OTP and verify email
router.post(
  "/verify-email",
  checkCookies,
  InputSensitization,
  asyncHandler(async (req, res) => {
    const { email, code } = req.body;
    const isEmailCached = await OTP.checkOTP("auth", email, code);

    if (!isEmailCached.status) {
      return response.failure(res, isEmailCached.message, 400);
    }

    const hashedPassword = await User.hashPassword(isEmailCached.data.password);

    const newUser = await User.create({
      name: isEmailCached.data.name,
      email: isEmailCached.data.email,
      password: hashedPassword,
      role: isEmailCached.data.role,
    });

    const isDeletedOTP = await clearOTP("auth", email);

    const token = createAuthToken(
      newUser._id.toString(),
      newUser.email,
      newUser.role,
    );

    res.cookie("token", token, {
      httpOnly: true,
      // secure: process.env.NODE_ENV === "production",
      // sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return response.success(res, "Email verified successfully", 200);
  }),
);

// Login
router.post(
  "/login",
  checkCookies,
  InputSensitization,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const isExistOTP = await OTP.checkOTP("auth", email);

    if (isExistOTP.status) {
      return response.failure(res, isExistOTP.message, 400);
    }

    const user: any = await User.isUserExists(email);

    if (!user) {
      return response.failure(res, "Email is not registered", 400);
    }

    const isPasswardValid = await User.comparePassword(password, user.password);

    if (!isPasswardValid) {
      return response.failure(res, "Invalid credentials", 400);
    }

    const token = createAuthToken(user._id.toString(), user.email, user.role);

    res.cookie("token", token, {
      httpOnly: true,
      // secure: process.env.NODE_ENV === "production",
      // sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return response.success(res, "Logged in successfully", 200);
  }),
);

// Logout
router.get(
  "/logout",
  checkCookies,
  asyncHandler(async (req, res) => {
    res.clearCookie("token");
    return response.success(res, "Logged out successfully", 200);
  }),
);

// Request OTP for forgot password
router.post(
  "/forgot-password",
  checkCookies,
  InputSensitization,
  asyncHandler(async (req, res) => {
    const { email, newPassword } = req.body;

    const isExistOTP = await OTP.checkOTP("pass", email);

    if (isExistOTP.status) {
      return response.failure(res, isExistOTP.message, 400);
    }

    const user = await User.isUserExists(email);

    if (!user) {
      return response.failure(res, "Email is not registered", 400);
    }

    const createdOTP = await generateOTP("pass", { email, newPassword }, 2);

    if (!createdOTP.otpSession) {
      return response.failure(res, "Failed to generate OTP", 500);
    }

    // send OTP via email logic goes here (omitted for brevity)

    return response.success(res, "OTP sent successfully", 200, {
      otp: createdOTP.otp,
    });
  }),
);
// Verify OTP and verify email for forgot password
router.post(
  "/verify-forgot-password",
  checkCookies,
  InputSensitization,
  asyncHandler(async (req, res) => {
    const { email, code } = req.body;

    const isEmailCached = await OTP.checkOTP("pass", email, code);

    if (!isEmailCached.status) {
      return response.failure(res, isEmailCached.message, 400);
    }

    const hashedPassword = await User.hashPassword(
      isEmailCached.data.newPassword,
    );

    const updatedUser = await User.updatePassword(email, hashedPassword);

    if (!updatedUser) {
      return response.failure(res, "Failed to update password", 500);
    }

    const isDeletedOTP = await clearOTP("pass", email);

    const token = createAuthToken(
      updatedUser._id.toString(),
      updatedUser.email,
      updatedUser.role,
    );

    res.cookie("token", token, {
      httpOnly: true,
      // secure: process.env.NODE_ENV === "production",
      // sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return response.success(
      res,
      "Password updated successfully, Logged in automatically",
      200,
    );
  }),
);

export default router;
