// CAPTCHA verification utilities

export interface CaptchaVerificationResult {
  success: boolean
  score?: number // For reCAPTCHA v3
  error?: string
}

// Verify Google reCAPTCHA v3
export async function verifyRecaptcha(token: string, action: string = 'submit'): Promise<CaptchaVerificationResult> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY
  
  if (!secretKey) {
    return { success: false, error: 'reCAPTCHA not configured' }
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    })

    const data = await response.json()

    if (data.success) {
      // For reCAPTCHA v3, check score (0.0 to 1.0, higher is better)
      const score = data.score || 1.0
      const minScore = 0.5 // Adjust threshold as needed
      
      if (score >= minScore) {
        return { success: true, score }
      } else {
        return { success: false, error: 'Low confidence score', score }
      }
    } else {
      return { 
        success: false, 
        error: data['error-codes']?.join(', ') || 'Verification failed' 
      }
    }
  } catch (error) {
    console.error('reCAPTCHA verification error:', error)
    return { success: false, error: 'Verification service unavailable' }
  }
}

// Verify hCaptcha
export async function verifyHcaptcha(token: string): Promise<CaptchaVerificationResult> {
  const secretKey = process.env.HCAPTCHA_SECRET_KEY
  
  if (!secretKey) {
    return { success: false, error: 'hCaptcha not configured' }
  }

  try {
    const response = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    })

    const data = await response.json()

    if (data.success) {
      return { success: true }
    } else {
      return { 
        success: false, 
        error: data['error-codes']?.join(', ') || 'Verification failed' 
      }
    }
  } catch (error) {
    console.error('hCaptcha verification error:', error)
    return { success: false, error: 'Verification service unavailable' }
  }
}

// Generic CAPTCHA verification (auto-detects type based on env vars)
export async function verifyCaptcha(token: string, action?: string): Promise<CaptchaVerificationResult> {
  if (process.env.RECAPTCHA_SECRET_KEY) {
    return verifyRecaptcha(token, action)
  } else if (process.env.HCAPTCHA_SECRET_KEY) {
    return verifyHcaptcha(token)
  } else {
    return { success: false, error: 'No CAPTCHA service configured' }
  }
}

// Rate limiting helper (simple in-memory store - use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(identifier: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): boolean {
  const now = Date.now()
  const key = identifier
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetTime) {
    // Reset or create new record
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= maxAttempts) {
    return false // Rate limit exceeded
  }

  record.count++
  return true
}

// Clean up expired rate limit records
export function cleanupRateLimit(): void {
  const now = Date.now()
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}

// Auto cleanup every 5 minutes
if (typeof window === 'undefined') { // Server-side only
  setInterval(cleanupRateLimit, 5 * 60 * 1000)
}