require("dotenv").config();

// Render's free tier blocks all outbound SMTP traffic at the network level
// (see https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports),
// which is why the original Gmail/nodemailer SMTP transport could never
// actually deliver mail once deployed there (it worked fine locally, where
// no such block exists). SendGrid's API is plain HTTPS (port 443), so it is
// not affected by that block.
//
// We moved here from Resend because Resend requires a verified *domain* to
// send to arbitrary recipients. SendGrid only requires a verified *single
// sender address* (Settings -> Sender Authentication -> Single Sender
// Verification) to unlock sending to any recipient — no domain purchase
// needed. SENDGRID_API_KEY is set as a Render environment variable; it is
// never committed to the repo.
const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";

// Must exactly match the address verified in SendGrid's Single Sender
// Verification, or every send is rejected with a 403.
const FROM_ADDRESS = process.env.SENDGRID_FROM || "utsav6467@gmail.com";
const FROM_NAME = "ZoHo Web";

const sendOtpToEmail = async (email, otp) => {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error("SENDGRID_API_KEY is not configured on the server.");
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

  // Fail fast instead of hanging if SendGrid itself is ever slow/unreachable.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  let res;
  try {
    res = await fetch(SENDGRID_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: FROM_ADDRESS, name: FROM_NAME },
        subject: "Your ZoHo Web OTP Code",
        content: [{ type: "text/html", value: html }],
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

  // SendGrid returns 202 with an empty body on success — no JSON to parse.
  if (!res.ok) {
    let details = "";
    try {
      const body = await res.json();
      details = body && body.errors ? JSON.stringify(body.errors) : JSON.stringify(body);
    } catch (_) {
      details = await res.text().catch(() => "");
    }
    console.error(`[emailService] SendGrid send FAILED (${res.status}): ${details}`);
    throw new Error(`SendGrid API responded with ${res.status}: ${details}`);
  }

  const messageId = res.headers.get("x-message-id");
  console.log(`[emailService] OTP email queued via SendGrid for ${email} — id: ${messageId}`);
  return { id: messageId };
};

module.exports = { sendOtpToEmail };
