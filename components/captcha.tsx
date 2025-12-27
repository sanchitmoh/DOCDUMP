"use client"

import { useEffect, useRef, useState } from 'react'
import { Shield, RefreshCw } from 'lucide-react'

interface CaptchaProps {
  onVerify: (token: string) => void
  onError?: (error: string) => void
  action?: string
  theme?: 'light' | 'dark'
  size?: 'compact' | 'normal'
  className?: string
}

declare global {
  interface Window {
    grecaptcha?: any
    hcaptcha?: any
    onRecaptchaLoad?: () => void
    onHcaptchaLoad?: () => void
  }
}

export function Captcha({ 
  onVerify, 
  onError, 
  action = 'submit', 
  theme = 'dark',
  size = 'normal',
  className = '' 
}: CaptchaProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isScriptLoaded, setIsScriptLoaded] = useState(false)
  const captchaRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const isInitialized = useRef(false)

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY
  const isRecaptcha = !!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
  const isHcaptcha = !!process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY

  useEffect(() => {
    if (!siteKey) {
      const errorMsg = 'CAPTCHA not configured. Please check your environment variables.'
      setError(errorMsg)
      onError?.(errorMsg)
      return
    }

    // Check if script is already loaded
    if (isRecaptcha && window.grecaptcha) {
      setIsScriptLoaded(true)
      initializeRecaptcha()
      return
    }

    if (isHcaptcha && window.hcaptcha) {
      setIsScriptLoaded(true)
      initializeHcaptcha()
      return
    }

    // Load script if not already loaded
    if (!isScriptLoaded) {
      loadCaptchaScript()
    }
  }, [siteKey, isScriptLoaded])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (widgetId.current) {
        try {
          if (isRecaptcha && window.grecaptcha) {
            window.grecaptcha.reset(widgetId.current)
          } else if (isHcaptcha && window.hcaptcha) {
            window.hcaptcha.reset(widgetId.current)
          }
        } catch (error) {
          console.warn('Error cleaning up CAPTCHA:', error)
        }
      }
      isInitialized.current = false
    }
  }, [isRecaptcha, isHcaptcha])

  const loadCaptchaScript = () => {
    // Check if script already exists
    const existingScript = document.querySelector(
      isRecaptcha 
        ? 'script[src*="recaptcha"]' 
        : 'script[src*="hcaptcha"]'
    )
    
    if (existingScript) {
      setIsScriptLoaded(true)
      return
    }

    const script = document.createElement('script')
    
    if (isRecaptcha) {
      script.src = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit'
      window.onRecaptchaLoad = () => {
        setIsScriptLoaded(true)
        initializeRecaptcha()
      }
    } else if (isHcaptcha) {
      script.src = 'https://js.hcaptcha.com/1/api.js?onload=onHcaptchaLoad&render=explicit'
      window.onHcaptchaLoad = () => {
        setIsScriptLoaded(true)
        initializeHcaptcha()
      }
    }

    script.async = true
    script.defer = true
    script.onerror = () => {
      const errorMsg = 'Failed to load CAPTCHA script'
      setError(errorMsg)
      onError?.(errorMsg)
    }
    
    document.head.appendChild(script)
  }

  const initializeRecaptcha = () => {
    if (!window.grecaptcha || !captchaRef.current || !siteKey || isInitialized.current) {
      return
    }

    try {
      // Check if reCAPTCHA v3 (invisible)
      if (process.env.NEXT_PUBLIC_RECAPTCHA_V3 === 'true') {
        window.grecaptcha.ready(() => {
          setIsLoaded(true)
          isInitialized.current = true
        })
      } else {
        // Clear any existing widget
        if (captchaRef.current) {
          captchaRef.current.innerHTML = ''
        }

        // For reCAPTCHA v2 (checkbox)
        widgetId.current = window.grecaptcha.render(captchaRef.current, {
          sitekey: siteKey,
          theme: theme,
          size: size,
          callback: handleSuccess,
          'error-callback': handleError,
          'expired-callback': handleExpired,
        })
        setIsLoaded(true)
        isInitialized.current = true
      }
    } catch (error) {
      console.error('reCAPTCHA initialization error:', error)
      handleError('Failed to initialize CAPTCHA. Please refresh the page.')
    }
  }

  const initializeHcaptcha = () => {
    if (!window.hcaptcha || !captchaRef.current || !siteKey || isInitialized.current) {
      return
    }

    try {
      // Clear any existing widget
      if (captchaRef.current) {
        captchaRef.current.innerHTML = ''
      }

      widgetId.current = window.hcaptcha.render(captchaRef.current, {
        sitekey: siteKey,
        theme: theme,
        size: size,
        callback: handleSuccess,
        'error-callback': handleError,
        'expired-callback': handleExpired,
      })
      setIsLoaded(true)
      isInitialized.current = true
    } catch (error) {
      console.error('hCaptcha initialization error:', error)
      handleError('Failed to initialize CAPTCHA. Please refresh the page.')
    }
  }

  const handleSuccess = (token: string) => {
    setError(null)
    onVerify(token)
  }

  const handleError = (error?: string) => {
    const errorMsg = error || 'CAPTCHA verification failed'
    setError(errorMsg)
    onError?.(errorMsg)
  }

  const handleExpired = () => {
    handleError('CAPTCHA expired. Please try again.')
    reset()
  }

  const executeRecaptchaV3 = async () => {
    if (!window.grecaptcha || !siteKey) {
      handleError('CAPTCHA not ready')
      return
    }

    setIsLoading(true)
    try {
      const token = await window.grecaptcha.execute(siteKey, { action })
      handleSuccess(token)
    } catch (error) {
      console.error('reCAPTCHA execution error:', error)
      handleError('CAPTCHA execution failed')
    } finally {
      setIsLoading(false)
    }
  }

  const reset = () => {
    try {
      if (isRecaptcha && window.grecaptcha && widgetId.current) {
        window.grecaptcha.reset(widgetId.current)
      } else if (isHcaptcha && window.hcaptcha && widgetId.current) {
        window.hcaptcha.reset(widgetId.current)
      }
      setError(null)
    } catch (error) {
      console.warn('Error resetting CAPTCHA:', error)
    }
  }

  // Show error state
  if (error && !siteKey) {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
          <p className="text-red-300 text-xs mt-1">
            Please configure CAPTCHA keys in your environment variables.
          </p>
        </div>
      </div>
    )
  }

  // For reCAPTCHA v3, provide a button to execute
  if (isRecaptcha && process.env.NEXT_PUBLIC_RECAPTCHA_V3 === 'true') {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <button
          type="button"
          onClick={executeRecaptchaV3}
          disabled={!isLoaded || isLoading}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
        >
          {isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Shield className="w-4 h-4" />
          )}
          {isLoading ? 'Verifying...' : 'Verify Human'}
        </button>
        {error && (
          <div className="flex items-center gap-2">
            <p className="text-red-400 text-sm flex-1">{error}</p>
            <button
              type="button"
              onClick={reset}
              className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          </div>
        )}
      </div>
    )
  }

  // For reCAPTCHA v2 or hCaptcha (checkbox)
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div ref={captchaRef} className="flex justify-center min-h-[78px]" />
      {error && (
        <div className="flex items-center gap-2">
          <p className="text-red-400 text-sm flex-1">{error}</p>
          <button
            type="button"
            onClick={reset}
            className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      )}
      {!isLoaded && !error && (
        <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading CAPTCHA...</span>
        </div>
      )}
    </div>
  )
}