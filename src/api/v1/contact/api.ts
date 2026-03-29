import express from "express";
import asyncHandler from "../../../utils/async-handler.js";
import response from "../../../utils/response.js";
import { sendEmail } from "../../../libs/brevo.js";

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return response.failure(res, "All fields are required", 400);
    }

    const adminEmail = "admin@ethnicelegance.store";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #222; line-height: 1.6;">
        <h2 style="margin: 0 0 12px; color: #1f3a56;">New Contact Form Submission</h2>
        <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #ddd; font-weight: 600; width: 120px;">Name:</td><td style="padding: 8px 0; border-bottom: 1px solid #ddd;">${name}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #ddd; font-weight: 600;">Email:</td><td style="padding: 8px 0; border-bottom: 1px solid #ddd;">${email}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #ddd; font-weight: 600;">Subject:</td><td style="padding: 8px 0; border-bottom: 1px solid #ddd;">${subject}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: 600;" colspan="2">Message:</td></tr>
          <tr><td style="padding: 8px 0; white-space: pre-wrap;" colspan="2">${message}</td></tr>
        </table>
      </div>
    `;

    try {
      await sendEmail({
        subject: `Contact Form: ${subject}`,
        htmlContent: emailHtml,
        to: { email: adminEmail, name: "Admin" }
      });
      return response.success(res, "Message sent successfully", 200);
    } catch (error) {
      console.error("Error sending contact email:", error);
      return response.failure(res, "Failed to send message. Please try again later.", 500);
    }
  })
);

export default router;
