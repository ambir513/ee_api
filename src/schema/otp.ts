import mongoose from "mongoose";
import { otpDocument, otpModel } from "./types.js";

const otpSchema = new mongoose.Schema<otpDocument, otpModel>(
  {
    email: { type: String, required: true },
    otp: { type: String, required: true },
    label: { type: String },

    name: { type: String },
    password: { type: String },
    role: { type: String },
  },
  { timestamps: true },
);

otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 120 });

otpSchema.statics.checkOTP = async function (
  label: string,
  email: string,
  otp?: string,
): Promise<any> {
  const cachedOTP = await this.findOne({ email, label }).exec();
  if (cachedOTP) {
    if (otp) {
      if (cachedOTP.otp === otp) {
        return {
          status: true,
          message: "OTP verified successfully",
          data: cachedOTP,
        };
      }
      return { status: false, message: "Invalid OTP", data: null };
    } else {
      return {
        status: true,
        message: "OTP already sent. Please check your email.",
        data: cachedOTP,
      };
    }
  }
  return {
    status: false,
    message: "OTP has expired or is invalid",
    data: null,
  };
};

const OTP = mongoose.model<otpDocument, otpModel>("OTP", otpSchema);
export default OTP;
