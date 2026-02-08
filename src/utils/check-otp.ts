import redisClient from "../libs/redis.js";

/**
 * Checks if an OTP exists in Redis for the given label and email.
 * @param label Label for the OTP (e.g., "sign-up", "login").
 * @param email Email address associated with the OTP.
 * @returns True if the OTP exists, false otherwise.
 */
export default async function checkOTP(
  label: string,
  email: string,
  otp?: string,
): Promise<any> {
  const cachedOTP = await redisClient.get(`otp?${label}=${email}`);
  console.log(cachedOTP);
  if (cachedOTP) {
    if (typeof cachedOTP !== "string") {
      return {
        status: false,
        message: "OTP has expired or is invalid",
        data: null,
      };
    }

    const parsedOTP = JSON.parse(cachedOTP);
    if (otp) {
      console.log(parsedOTP.code === parseInt(otp, 10));
      console.log(parsedOTP.code, otp);
      if (parsedOTP.code === parseInt(otp, 10)) {
        return {
          status: true,
          message: "OTP verified successfully",
          data: parsedOTP,
        };
      } else {
        return { status: false, message: "Invalid OTP", data: null };
      }
    } else {
      return {
        status: true,
        message: "OTP already sent. Please check your email.",
        data: parsedOTP,
      };
    }
  }

  return {
    status: false,
    message: "OTP has expired or is invalid",
    data: null,
  };
}
