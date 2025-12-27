"use client"

import type React from "react"

import Link from "next/link"
import { useState, useRef, useEffect } from "react"
import { Mail, RotateCcw, ArrowRight } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { VideoBackground } from "@/components/video-background"
import { useToast } from "@/hooks/use-toast"

export default function VerifyOTP() {
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [timeLeft, setTimeLeft] = useState(60)
  const [isLoading, setIsLoading] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const { verifyOTP } = useAuth()
  const router = useRouter()
  const { addToast } = useToast()

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [timeLeft])

  const handleChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleBackspace = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    const otpCode = otp.join("")
    
    if (otpCode.length !== 6) {
      addToast("Please enter all 6 digits", "error")
      return
    }

    const tempToken = localStorage.getItem("tempToken")
    if (!tempToken) {
      addToast("Verification session expired. Please register again.", "error")
      router.push("/signup")
      return
    }

    setIsLoading(true)
    
    try {
      const result = await verifyOTP(otpCode, tempToken)
      
      if (result.success) {
        addToast(result.message, "success")
        // Clear stored data
        localStorage.removeItem("tempToken")
        localStorage.removeItem("signupEmail")
        router.push("/login")
      } else {
        addToast(result.message, "error")
      }
    } catch (error) {
      addToast("An unexpected error occurred", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (timeLeft > 0) return
    
    // In a real implementation, you would call an API to resend OTP
    addToast("OTP resent successfully!", "success")
    setTimeLeft(60)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <VideoBackground />

      <main className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-md">
          <div className="glass rounded-lg p-8 mb-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Verify Your Email</h1>
              <p className="text-muted-foreground">
                We've sent a 6-digit code to{" "}
                <span className="text-foreground font-medium">
                  {typeof window !== 'undefined' ? localStorage.getItem("signupEmail") || "your email" : "your email"}
                </span>
              </p>
            </div>

            <form onSubmit={handleVerify} className="space-y-6">
              {/* OTP Input */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-4 text-center">
                  Enter verification code
                </label>
                <div className="flex gap-3 justify-center">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (inputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleChange(e.target.value, index)}
                      onKeyDown={(e) => handleBackspace(index, e)}
                      className="w-12 h-12 text-center text-xl font-bold bg-white/5 border border-white/10 rounded-lg text-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    />
                  ))}
                </div>
              </div>

              {/* Resend */}
              <div className="text-center">
                {timeLeft > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Resend code in <span className="text-primary font-medium">{timeLeft}s</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Resend code
                  </button>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || otp.some(digit => !digit)}
                className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Verify Email
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-muted-foreground text-sm">
                Didn't receive the code?{" "}
                <Link href="/signup" className="text-primary hover:text-primary/80 transition-colors">
                  Try again
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
