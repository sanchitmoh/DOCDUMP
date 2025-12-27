import { NextResponse } from 'next/server'
import { testEmailConfig, sendOTPEmail } from '@/lib/email'

export async function GET() {
  try {
    console.log('Testing email configuration...')
    
    // Check environment variables
    const emailConfig = {
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS ? '***configured***' : 'NOT SET',
    }
    
    console.log('Email config:', emailConfig)
    
    // Test email configuration
    const isConfigValid = await testEmailConfig()
    
    if (!isConfigValid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Email configuration test failed',
          config: emailConfig,
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Email configuration is valid',
      config: emailConfig,
    })
    
  } catch (error) {
    console.error('Email test error:', error)
    
    return NextResponse.json(
      {
        success: false,
        message: 'Email test failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function POST() {
  try {
    const testEmail = process.env.SMTP_USER || 'test@example.com'
    const testOTP = '123456'
    
    console.log(`Sending test OTP email to: ${testEmail}`)
    
    const emailSent = await sendOTPEmail(testEmail, testOTP, 'Test User')
    
    if (emailSent) {
      return NextResponse.json({
        success: true,
        message: `Test email sent successfully to ${testEmail}`,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to send test email',
        },
        { status: 500 }
      )
    }
    
  } catch (error) {
    console.error('Test email sending error:', error)
    
    return NextResponse.json(
      {
        success: false,
        message: 'Test email failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}