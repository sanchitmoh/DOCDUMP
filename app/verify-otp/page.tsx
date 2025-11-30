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

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault()
    const otpCode = otp.join("")
    if (otpCode.length !== 6) {
      addToast("Please enter all 6 digits", "error")
      return
    }
    setIsLoading(true)
    verifyOTP(otpCode)
      .then(() => {
        addToast("Email verified successfully!", "success")
        router.push("/login")
      })
      .catch(() => {
        addToast("Verification failed. Please try again.", "error")
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  const handleResend = () => {
    setOtp(["", "", "", "", "", ""])
    setTimeLeft(60)
  }

  return (
    <div className="relative min-h-screen bg-background flex flex-col">
      <VideoBackground />
      <div className="relative z-10 flex flex-col flex-1">
        <Navbar />

        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            <div className="glass rounded-lg p-8 mb-8">
              <div className="text-center mb-8">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-6 h-6 text-primary-foreground" />
                </div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Verify Email</h1>
                <p className="text-muted-foreground">We've sent a 6-digit code to your email. Enter it below.</p>
              </div>

              <form onSubmit={handleVerify} className="space-y-6">
                {/* OTP Input */}
                <div className="flex gap-2 justify-center">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        inputRefs.current[index] = el
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      aria-label={`OTP digit ${index + 1}`}
                      onChange={(e) => handleChange(e.target.value, index)}
                      onKeyDown={(e) => handleBackspace(index, e)}
                      className="w-12 h-12 bg-card border border-border rounded-lg text-center text-lg font-semibold text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  ))}
                </div>

                {/* Resend */}
                <div className="text-center">
                  {timeLeft > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Resend code in <span className="font-semibold text-foreground">{timeLeft}s</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      className="text-sm text-primary hover:text-accent transition font-medium flex items-center justify-center space-x-1 mx-auto"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Resend Code</span>
                    </button>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-primary hover:opacity-90 transition rounded-lg text-primary-foreground font-medium flex items-center justify-center space-x-2"
                >
                  {isLoading ? "Verifying..." : "Verify Email"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Help */}
              <p className="text-center text-sm text-muted-foreground mt-6">
                Didn't receive the code?{" "}
                <Link href="/contact-support" className="text-primary hover:text-accent transition">
                  Contact support
                </Link>
              </p>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}
