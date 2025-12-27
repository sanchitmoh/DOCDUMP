import nodemailer from 'nodemailer'

// Email configuration
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
}

// Create transporter
let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport(emailConfig)
  }
  return transporter
}

// Generate OTP
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Send OTP email
export async function sendOTPEmail(email: string, otp: string, name?: string): Promise<boolean> {
  try {
    // Check if email configuration is available
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('Email configuration missing: SMTP_USER or SMTP_PASS not set')
      return false
    }

    const transporter = getTransporter()
    
    // Verify transporter configuration
    try {
      await transporter.verify()
      console.log('SMTP connection verified successfully')
    } catch (verifyError) {
      console.error('SMTP verification failed:', verifyError)
      return false
    }
    
    const mailOptions = {
      from: `"Corporate Digital Library" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Email Verification - Corporate Digital Library',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Corporate Digital Library</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Email Verification</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            ${name ? `<p>Hello <strong>${name}</strong>,</p>` : '<p>Hello,</p>'}
            
            <p>Thank you for registering with Corporate Digital Library. To complete your registration, please verify your email address using the OTP code below:</p>
            
            <div style="background: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
              <h2 style="color: #667eea; font-size: 32px; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">${otp}</h2>
            </div>
            
            <p><strong>Important:</strong></p>
            <ul style="color: #666;">
              <li>This OTP is valid for <strong>10 minutes</strong></li>
              <li>Do not share this code with anyone</li>
              <li>If you didn't request this verification, please ignore this email</li>
            </ul>
            
            <p>If you have any questions or need assistance, please contact our support team.</p>
            
            <p>Best regards,<br>
            <strong>Corporate Digital Library Team</strong></p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>&copy; ${new Date().getFullYear()} Corporate Digital Library. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
      text: `
        Corporate Digital Library - Email Verification
        
        ${name ? `Hello ${name},` : 'Hello,'}
        
        Thank you for registering with Corporate Digital Library. To complete your registration, please verify your email address using the OTP code below:
        
        OTP Code: ${otp}
        
        Important:
        - This OTP is valid for 10 minutes
        - Do not share this code with anyone
        - If you didn't request this verification, please ignore this email
        
        If you have any questions or need assistance, please contact our support team.
        
        Best regards,
        Corporate Digital Library Team
      `
    }

    console.log(`Attempting to send OTP email to: ${email}`)
    const result = await transporter.sendMail(mailOptions)
    console.log('Email sent successfully:', result.messageId)
    return true
  } catch (error) {
    console.error('Email sending error:', error)
    
    // Log specific error details
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    return false
  }
}

// Send password reset email with code
export async function sendPasswordResetEmail(email: string, resetCode: string, name?: string): Promise<boolean> {
  try {
    // Check if email configuration is available
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('Email configuration missing: SMTP_USER or SMTP_PASS not set')
      return false
    }

    const transporter = getTransporter()
    
    const mailOptions = {
      from: `"Corporate Digital Library" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Password Reset - Corporate Digital Library',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Corporate Digital Library</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Password Reset Request</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            ${name ? `<p>Hello <strong>${name}</strong>,</p>` : '<p>Hello,</p>'}
            
            <p>We received a request to reset your password for your Corporate Digital Library account. Use the reset code below to create a new password:</p>
            
            <div style="background: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
              <h2 style="color: #667eea; font-size: 32px; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">${resetCode}</h2>
            </div>
            
            <p><strong>Important:</strong></p>
            <ul style="color: #666;">
              <li>This reset code is valid for <strong>15 minutes</strong></li>
              <li>Do not share this code with anyone</li>
              <li>If you didn't request this reset, please ignore this email</li>
              <li>Your password will remain unchanged until you create a new one</li>
            </ul>
            
            <p>If you have any questions or need assistance, please contact our support team.</p>
            
            <p>Best regards,<br>
            <strong>Corporate Digital Library Team</strong></p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>&copy; ${new Date().getFullYear()} Corporate Digital Library. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
      text: `
        Corporate Digital Library - Password Reset
        
        ${name ? `Hello ${name},` : 'Hello,'}
        
        We received a request to reset your password for your Corporate Digital Library account. Use the reset code below to create a new password:
        
        Reset Code: ${resetCode}
        
        Important:
        - This reset code is valid for 15 minutes
        - Do not share this code with anyone
        - If you didn't request this reset, please ignore this email
        - Your password will remain unchanged until you create a new one
        
        If you have any questions or need assistance, please contact our support team.
        
        Best regards,
        Corporate Digital Library Team
      `
    }

    console.log(`Attempting to send password reset email to: ${email}`)
    const result = await transporter.sendMail(mailOptions)
    console.log('Password reset email sent successfully:', result.messageId)
    return true
  } catch (error) {
    console.error('Password reset email sending error:', error)
    
    // Log specific error details
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    return false
  }
}

// Send password reset email with URL (legacy function)
export async function sendPasswordResetEmailWithURL(email: string, resetToken: string, name?: string): Promise<boolean> {
  try {
    const transporter = getTransporter()
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`
    
    const mailOptions = {
      from: `"Corporate Digital Library" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Password Reset - Corporate Digital Library',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Corporate Digital Library</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Password Reset Request</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            ${name ? `<p>Hello <strong>${name}</strong>,</p>` : '<p>Hello,</p>'}
            
            <p>We received a request to reset your password for your Corporate Digital Library account. Click the button below to reset your password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
            
            <p><strong>Important:</strong></p>
            <ul style="color: #666;">
              <li>This link is valid for <strong>1 hour</strong></li>
              <li>If you didn't request this reset, please ignore this email</li>
              <li>Your password will remain unchanged until you create a new one</li>
            </ul>
            
            <p>If you have any questions or need assistance, please contact our support team.</p>
            
            <p>Best regards,<br>
            <strong>Corporate Digital Library Team</strong></p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>&copy; ${new Date().getFullYear()} Corporate Digital Library. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
    }

    await transporter.sendMail(mailOptions)
    return true
  } catch (error) {
    console.error('Email sending error:', error)
    return false
  }
}

// Test email configuration
export async function testEmailConfig(): Promise<boolean> {
  try {
    const transporter = getTransporter()
    await transporter.verify()
    return true
  } catch (error) {
    console.error('Email configuration test failed:', error)
    return false
  }
}