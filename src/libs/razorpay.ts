import Razorpay from "razorpay";
import { log } from "../utils/logger.js";

const keyId = process.env.RAZORPAY_KEY_ID || "";
const keySecret = process.env.RAZORPAY_KEY_SECRET || "";

if (!keyId || !keySecret) {
  log("⚠️  RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing in .env!", "error");
} else {
  const mode = keyId.startsWith("rzp_live") ? "LIVE" : "TEST";
  log(`Razorpay initialized in ${mode} mode (key: ${keyId.substring(0, 12)}...)`, "success");
}

const razorpayInstance = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

export default razorpayInstance;
