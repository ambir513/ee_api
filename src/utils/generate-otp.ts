// import redisClient from "../libs/redis.js";
import crypto from "node:crypto";
import OTP from "../schema/otp.js";

/**
 * Generates a numeric OTP 6 digits.
 * Store in Redis with an expiry time.
 * @param label Label for the OTP (e.g., "sign-up", "login").
 * @param email Email address to send the OTP to.
 * @param expire Expiry time in minutes.
 * @returns A numeric OTP of the specified length.
 */
export default async function generateOTP(
  label: string,
  data: Record<string, any>,
  expire: number,
): Promise<{ otp: number; otpSession: any }> {
  const otp = crypto.randomInt(100000, 1000000);

  const otpSession = await OTP.create({
    email: data.email,
    otp: otp.toString(),
    name: data.name,
    password: data.password,
    role: data.role,
    label,
  });

  return {
    otp,
    otpSession,
  };
}
