require("dotenv").config();

// Render's free tier blocks all outbound SMTP traffic at the network level
// (see https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports),
// which is why the previous Gmail/nodemailer SMTP transport could never
// actually deliver mail once deployed there (it worked fine locally, where
// no such block exists). Resend's API is plain HTTPS (port 443), so it is
// not affected by that block. RESEND_API_KEY is set as a Render environment
// variable — it is never committed to the repo.
const RESEND_API_URL = "https://api.resend.com/emails";

// Resend's free tier only allows sending from this shared address unless a
// custom domain has been verified in the Resend dashboard. Once a domain is
// verified there, this can be changed to e.g. "ZoHo Web <noreply@yourdomain.com>".
const FROM_ADDRESS = process.env.RESEND_FROM || "ZoHo Web <onboarding@resend.dev>";

const sendOtpToEmail = async (email, otp) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured on the server.");
  }

  const html = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <h2 style="color: #075e54;">ZoHo Web Verification</h2>

        <p>Hi there,</p>

        <p>Your one-time password (OTP) to verify your ZoHo Web account is:</p>

        <h1 style="background: #e0f7fa; color: #000; padding: 10px 20px; display: inline-block; border-radius: 5px; letter-spacing: 2px;">
          ${otp}
        </h1>

        <p><strong>This OTP is valid for the next 5 minutes.</strong> Please do not share this code with anyone.</p>

        <p>If you didn't request this OTP, please ignore this email.</p>

        <p style="margin-top: 20px;">Thanks & Regards, <br/> Akshit <br/>ZoHo Web Security Team</p>

        <hr style="margin: 30px 0;" />

        <small style="color: #777;">This is an automated message. Please do not reply.</small>
      </div>
    `;

  // Fail fast instead of hanging if Resend itself is ever slow/unreachable.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  let res;
  try {
    res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [email],
        subject: "Your ZoHo Web OTP Code",
        html,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Timed out contacting the email provider.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    let details = "";
    try {
      const body = await res.json();
      details = body && body.message ? body.message : JSON.stringify(body);
    } catch (_) {
      details = await res.text().catch(() => "");
    }
    console.error(`[emailService] Resend send FAILED (${res.status}): ${details}`);
    throw new Error(`Resend API responded with ${res.status}: ${details}`);
  }

  const data = await res.json();
  console.log(`[emailService] OTP email queued via Resend for ${email} — id: ${data.id}`);
  return data;
};

module.exports = { sendOtpToEmail };
