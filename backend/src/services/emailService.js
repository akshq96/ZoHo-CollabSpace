// console.log("=== ENV CHECK ===");
// console.log("EMAIL_USER:", process.env.EMAIL_USER);
// console.log("EMAIL_PASS LENGTH:", process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : "undefined");
// console.log("=================");

// const nodemailer = require('nodemailer');
// const dotenv = require('dotenv');
// dotenv.config();

// const transporter = nodemailer.createTransport({
//     service: 'Gmail',
//     auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS,
//     },
// });

// transporter.verify((error, success) => {
//     if (error) {
//         console.error('Error configuring email transporter:', error);
//     } else {
//         console.log('Email transporter is ready to send messages');
//     }
// });

// const sendOtpToEmail = async (email, otp) => {
//     const html = `
//     <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
//       <h2 style="color: #075e54;">🔐 ZoHo Web Verification</h2>
      
//       <p>Hi there,</p>
      
//       <p>Your one-time password (OTP) to verify your ZoHo Web account is:</p>
      
//       <h1 style="background: #e0f7fa; color: #000; padding: 10px 20px; display: inline-block; border-radius: 5px; letter-spacing: 2px;">
//         ${otp}
//       </h1>

//       <p><strong>This OTP is valid for the next 5 minutes.</strong> Please do not share this code with anyone.</p>

//       <p>If you didn’t request this OTP, please ignore this email.</p>

//       <p style="margin-top: 20px;">Thanks & Regards, <br/> Akshit <br/>ZoHo Web Security Team</p>

//       <hr style="margin: 30px 0;" />

//       <small style="color: #777;">This is an automated message. Please do not reply.</small>
//     </div>
//   `;

//   await transporter.sendMail({
//     from: `"ZoHo Web" <${process.env.EMAIL_USER}>`,
//     to: email,
//     subject: 'Your ZoHo Web OTP Code',
//     html,
//   })
// }
// module.exports = {
//     sendOtpToEmail,
// };

const nodemailer = require('nodemailer');
require("dotenv").config();

const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    }
});

const sendOtpToEmail = async (email, otp) => {
  const html = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <h2 style="color: #075e54;">🔐 ZoHo Web Verification</h2>
        
        <p>Hi there,</p>
        
        <p>Your one-time password (OTP) to verify your ZoHo Web account is:</p>
        
        <h1 style="background: #e0f7fa; color: #000; padding: 10px 20px; display: inline-block; border-radius: 5px; letter-spacing: 2px;">
          ${otp}
        </h1>
  
        <p><strong>This OTP is valid for the next 5 minutes.</strong> Please do not share this code with anyone.</p>
  
        <p>If you didn’t request this OTP, please ignore this email.</p>
  
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
