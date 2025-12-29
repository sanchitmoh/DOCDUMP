"use client"

import type React from "react"

import Link from "next/link"
import { useState } from "react"
import { Mail, ArrowRight, CheckCircle, User, Eye, EyeOff } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useToast } from "@/hooks/use-toast"

export default function ForgotPassword() {
  const [step, setStep] = useState<"email" | "reset">("email")
  const [email, setEmail] = useState("")
  const [userType, setUserType] = useState<"organization" | "employee">("employee")
  const [isLoading, setIsLoading] = useState(false)
  const [resetCode, setResetCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [tempToken, setTempToken] = useState("")
  const { addToast } = useToast()

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          userType,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        addToast(data.message, "success")
        if (data.tempToken) {
          setTempToken(data.tempToken)
        }
        setStep("reset")
      } else {
        addToast(data.error || "Failed to send reset email", "error")
      }
    } catch (error) {
      console.error('Forgot password error:', error)
      addToast("Failed to send reset email. Please try again.", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      addToast("Passwords do not match", "error")
      return
    }

    if (newPassword.length < 8) {
      addToast("Password must be at least 8 characters", "error")
      return
    }

    if (!resetCode || resetCode.length !== 6) {
      addToast("Please enter a valid 6-digit reset code", "error")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resetCode,
          newPassword,
          tempToken,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        addToast(data.message, "success")
        setTimeout(() => {
          window.location.href = "/login"
        }, 2000)
      } else {
        addToast(data.error || "Failed to reset password", "error")
      }
    } catch (error) {
      console.error('Reset password error:', error)
      addToast("Failed to reset password. Please try again.", "error")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="glass rounded-lg p-8 mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Forgot Password?</h1>
            <p className="text-muted-foreground mb-8">
              {step === "email"
                ? "Enter your email to receive a password reset link"
                : "Enter the reset code and your new password"}
            </p>

            {step === "email" ? (
              <form onSubmit={handleSendEmail} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2 flex items-center space-x-2">
                    <User className="w-4 h-4" />
                    <span>Account Type</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setUserType("employee")}
                      className={`p-3 rounded-lg border text-sm font-medium transition ${
                        userType === "employee"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      Employee
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserType("organization")}
                      className={`p-3 rounded-lg border text-sm font-medium transition ${
                        userType === "organization"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      Organization
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={userType === "organization" ? "admin@company.com" : "you@company.com"}
                      className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {userType === "organization" 
                      ? "Enter the admin email address used to register your organization"
                      : "Enter the email address associated with your employee account"
                    }
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-primary hover:opacity-90 transition rounded-lg text-primary-foreground font-medium flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <span>{isLoading ? "Sending..." : "Send Reset Code"}</span>
                  {!isLoading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Reset Code</label>
                  <input
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-center text-2xl font-mono tracking-widest"
                    maxLength={6}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-2">Enter the 6-digit code sent to your email</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 pr-12 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Must be at least 8 characters and different from your current password</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 pr-12 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-primary hover:opacity-90 transition rounded-lg text-primary-foreground font-medium flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <span>{isLoading ? "Resetting..." : "Reset Password"}</span>
                  {!isLoading && <CheckCircle className="w-4 h-4" />}
                </button>
              </form>
            )}

            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-center text-sm text-muted-foreground">
                Remember your password?{" "}
                <Link href="/login" className="text-primary hover:text-accent transition font-medium">
                  Sign in
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
