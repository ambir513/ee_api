// import redisClient from "../libs/redis.js";

import OTP from "../schema/otp.js";

/**
 * Clears the OTP from the database.
 * Store in Redis with an expiry time.
 * @param label Label for the OTP (e.g., "sign-up", "login").
 * @param email Email address to send the OTP to.
 * @returns The number of keys that were removed.
 */
export default async function clearOTP(
  label: string,
  email: string,
): Promise<any> {
  const deleted = await OTP.findOneAndDelete({ email, label });

  return deleted;
}
