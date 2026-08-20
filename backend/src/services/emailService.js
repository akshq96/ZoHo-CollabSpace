const nodemailer = require('nodemailer');
require("dotenv").config();

// Render's free tier blocks all outbound SMTP traffic at the network level
// (see https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports).
// Without an explicit timeout, nodemailer's default TCP connect timeout is
// ~2 minutes, so a blocked connection just hangs instead of failing —
// the request "takes too much time" and the user has no idea why. These
// timeouts make it fail in a few seconds with a clear, catchable error
// instead, which authController.js turns into a proper 502 response.
// This does NOT restore email delivery on Render's free tier — that needs
// either an HTTP-based provider (Resend/SendGrid/Mailgun, all over port 443)
// or a paid Render plan. It only makes the failure fast and legible.
const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 8000, // time to establish the TCP connection
    greetingTimeout: 8000,   // time to receive the SMTP greeting after connecting
    socketTimeout: 10000,    // time allowed for the socket to be idle mid-transfer
});

const sendOtpToEmail = async (email, otp) => {
  const html = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <h2 style="color: #075e54;">Verification</h2>
        
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
    await transporter.sendMail({
          from: `"ZoHo Web" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'Your ZoHo Web OTP Code',
          html,
  })
}

module.exports = { sendOtpToEmail };
