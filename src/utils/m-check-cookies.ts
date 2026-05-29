import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import response from "./response.js";

declare global {
  namespace Express {
    interface Request {
      email?: string;
      _id?: string;
      role?: string;
    }
  }
}

const PUBLIC_ROUTES = [
  "/sign-up",
  "/resend-otp",
  "/verify-email",
  "/login",
  "/forgot-password",
  "/verify-forgot-password",
];

const PROTECTED_ROUTES = [
  "/product/create",
  "/product/variant/add",
  "/product/variant/edit",
  "/product/variant/delete",
  "/product/edit",
  "/coupon/create",
  "/coupon/edit",
  "/coupon/delete",
];

export default function checkCookies(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.cookies?.token;
  const isPublicRoute = PUBLIC_ROUTES.includes(req.path);
  const isProtectedRoute = PROTECTED_ROUTES.includes(req.path);

  if (!token) {
    if (isPublicRoute) return next();
    return response.failure(res, "Unauthorized: No token provided", 401);
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET!);
  } catch {
    return response.failure(res, "Unauthorized: Invalid token", 401);
  }

  if (isPublicRoute) {
    return response.failure(res, "Already logged in", 400);
  }

  if (isProtectedRoute) {
    if (decoded.role === "USER") {
      return response.failure(res, "Forbidden: Admins only", 403);
    }
  }

  req.email = decoded.email;
  req._id = decoded._id;
  req.role = decoded.role;

  next();
}
