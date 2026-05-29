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
import {
  sendEmail,
  buildOTPEmailTemplate,
  buildForgotPasswordEmailTemplate,
} from "../../../libs/brevo.js";
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

    if (!otpSession) {
      return response.failure(res, "Failed to generate OTP", 500);
    }

    // Send OTP via email with professional template
    try {
      await sendEmail({
        subject: "Verify Your Email - Ethnic Elegance",
        htmlContent: buildOTPEmailTemplate(otp, name),
        to: { email, name },
      });
    } catch (err) {
      // Clean up OTP if email fails
      await clearOTP("auth", email);
      console.error("Failed to send OTP email:", err);
      return response.failure(
        res,
        "Failed to send verification email. Please try again.",
        500,
      );
    }

    return response.success(res, "OTP sent successfully", 200);
  }),
);

// Resend OTP (dedicated endpoint so existing OTP is cleared and regenerated)
router.post(
  "/resend-otp",
  checkCookies,
  InputSensitization,
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    if (!email) {
      return response.failure(res, "Email is required", 400);
    }

    // Clear any existing OTP for this email
    await clearOTP("auth", email);

    const exists = await User.isUserExists(email);

    if (exists) {
      return response.failure(res, "User already exists", 400);
    }

    const { otp, otpSession } = await generateOTP(
      "auth",
      {
        name: name || "",
        email,
        password: password || "",
        role: isAdminEmail.includes(email.toLowerCase()) ? "ADMIN" : "USER",
      },
      2,
    );

    if (!otpSession) {
      return response.failure(res, "Failed to generate OTP", 500);
    }

    try {
      await sendEmail({
        subject: "Verify Your Email - Ethnic Elegance",
        htmlContent: buildOTPEmailTemplate(otp, name || "there"),
        to: { email, name: name || "" },
      });
    } catch (err) {
      await clearOTP("auth", email);
      console.error("Failed to resend OTP email:", err);
      return response.failure(
        res,
        "Failed to send verification email. Please try again.",
        500,
      );
    }

    return response.success(res, "OTP resent successfully", 200);
  }),
);

// Verify OTP and verify email
router.post(
  "/verify-email",
  checkCookies,
  InputSensitization,
  asyncHandler(async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
      return response.failure(res, "Email and verification code are required", 400);
    }

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

    await clearOTP("auth", email);

    const token = createAuthToken(
      newUser._id.toString(),
      newUser.email,
      newUser.role,
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return response.success(res, "Email verified successfully", 200, {
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  }),
);

// Login
router.post(
  "/login",
  checkCookies,
  InputSensitization,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return response.failure(res, "Email and password are required", 400);
    }

    const isExistOTP = await OTP.checkOTP("auth", email);

    if (isExistOTP.status) {
      return response.failure(res, isExistOTP.message, 400);
    }

    const user: any = await User.isUserExists(email);

    if (!user) {
      return response.failure(res, "Invalid credentials", 400);
    }

    const isPasswordValid = await User.comparePassword(password, user.password);

    if (!isPasswordValid) {
      return response.failure(res, "Invalid credentials", 400);
    }

    const token = createAuthToken(user._id.toString(), user.email, user.role);

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return response.success(res, "Logged in successfully", 200, {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  }),
);

// Logout
router.get(
  "/logout",
  checkCookies,
  asyncHandler(async (req, res) => {
    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
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

    if (!email || !newPassword) {
      return response.failure(res, "Email and new password are required", 400);
    }

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

    try {
      await sendEmail({
        subject: "Reset Your Password - Ethnic Elegance",
        htmlContent: buildForgotPasswordEmailTemplate(createdOTP.otp, email),
        to: { email, name: user.name || "" },
      });
    } catch (err: any) {
      await clearOTP("pass", email);
      console.error("Failed to send forgot-password email:", err?.body || err?.message || err);
      return response.failure(
        res,
        "Failed to send verification email. Please try again.",
        500,
      );
    }

    return response.success(res, "OTP sent successfully", 200);
  }),
);

// Verify OTP and verify email for forgot password
router.post(
  "/verify-forgot-password",
  checkCookies,
  InputSensitization,
  asyncHandler(async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
      return response.failure(res, "Email and verification code are required", 400);
    }

    const isEmailCached = await OTP.checkOTP("pass", email, code);

    if (!isEmailCached.status) {
      return response.failure(res, isEmailCached.message, 400);
    }

    const hashedPassword = await User.hashPassword(
      isEmailCached.data.password,
    );

    const updatedUser = await User.updatePassword(email, hashedPassword);

    if (!updatedUser) {
      return response.failure(res, "Failed to update password", 500);
    }

    await clearOTP("pass", email);

    const token = createAuthToken(
      updatedUser._id.toString(),
      updatedUser.email,
      updatedUser.role,
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return response.success(
      res,
      "Password updated successfully",
      200,
      {
        user: {
          _id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
        },
      },
    );
  }),
);

export default router;
