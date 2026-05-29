import {
  TransactionalEmailsApi,
  TransactionalEmailsApiApiKeys,
} from "@getbrevo/brevo";

const transactionalEmailsApi = new TransactionalEmailsApi();

const brevoApiKey = process.env.BREVO_API_KEY;
if (!brevoApiKey) {
  console.error("[Brevo] WARNING: BREVO_API_KEY is not set. Email sending will fail.");
}

transactionalEmailsApi.setApiKey(
  TransactionalEmailsApiApiKeys.apiKey,
  brevoApiKey || "",
);

/**
 * Generates a professional HTML email template that avoids spam filters.
 * Includes proper structure, branding, and compliance elements.
 */
function buildOTPEmailTemplate(otp: number, name: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Verify Your Email - Ethnic Elegance</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background-color:#1a1a2e;padding:30px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;letter-spacing:0.5px;">Ethnic Elegance</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="color:#333333;font-size:16px;line-height:1.6;margin:0 0 16px;">Hi ${name},</p>
              <p style="color:#333333;font-size:16px;line-height:1.6;margin:0 0 24px;">Thank you for signing up. Please use the verification code below to complete your registration:</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:20px 0;">
                    <div style="background-color:#f0f0f5;border:2px dashed #1a1a2e;border-radius:8px;padding:20px 40px;display:inline-block;">
                      <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#1a1a2e;">${otp}</span>
                    </div>
                  </td>
                </tr>
              </table>
              <p style="color:#666666;font-size:14px;line-height:1.6;margin:24px 0 0;">This code is valid for <strong>2 minutes</strong>. If you did not request this, please ignore this email.</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f9f9fb;padding:24px 40px;border-top:1px solid #eeeeee;">
              <p style="color:#999999;font-size:12px;line-height:1.5;margin:0;text-align:center;">
                This is an automated message from Ethnic Elegance.<br/>
                Please do not reply to this email.<br/><br/>
                &copy; ${new Date().getFullYear()} Ethnic Elegance. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generates a professional HTML email for forgot-password OTP.
 */
function buildForgotPasswordEmailTemplate(otp: number, email: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Your Password - Ethnic Elegance</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background-color:#1a1a2e;padding:30px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">Ethnic Elegance</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="color:#333333;font-size:16px;line-height:1.6;margin:0 0 16px;">Hi,</p>
              <p style="color:#333333;font-size:16px;line-height:1.6;margin:0 0 24px;">We received a request to reset the password for your account (${email}). Use the code below:</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:20px 0;">
                    <div style="background-color:#f0f0f5;border:2px dashed #1a1a2e;border-radius:8px;padding:20px 40px;display:inline-block;">
                      <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#1a1a2e;">${otp}</span>
                    </div>
                  </td>
                </tr>
              </table>
              <p style="color:#666666;font-size:14px;line-height:1.6;margin:24px 0 0;">This code expires in <strong>2 minutes</strong>. If you didn't request a password reset, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9f9fb;padding:24px 40px;border-top:1px solid #eeeeee;">
              <p style="color:#999999;font-size:12px;line-height:1.5;margin:0;text-align:center;">
                This is an automated message from Ethnic Elegance.<br/>
                Please do not reply to this email.<br/><br/>
                &copy; ${new Date().getFullYear()} Ethnic Elegance. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendEmail({
  subject,
  htmlContent,
  to,
}: {
  subject: string;
  htmlContent: string;
  to: { email: string; name: string };
}) {
  try {
    const res = await transactionalEmailsApi.sendTransacEmail({
      subject,
      htmlContent,
      sender: {
        name: "Ethnic Elegance",
        email: "team@ethnicelegance.store",
      },
      to: [{ email: to.email, name: to.name || to.email }],
      replyTo: { email: "support@ethnicelegance.store", name: "Ethnic Elegance Support" },
      headers: {
        "X-Mailer": "EthnicElegance/1.0",
        "List-Unsubscribe": "<mailto:unsubscribe@ethnicelegance.store>",
      },
    });

    return res.body.messageId;
  } catch (err: any) {
    // Log the full Brevo error response for debugging
    const errorBody = err?.body || err?.response?.body;
    const errorMessage = errorBody?.message || err?.message || "Unknown error";
    console.error("[Brevo] Email send failed:", JSON.stringify(errorBody || err?.message || err, null, 2));
    throw new Error(`Email delivery failed: ${errorMessage}`);
  }
}

export { buildOTPEmailTemplate, buildForgotPasswordEmailTemplate };
