"use client"

import type React from "react"

import Link from "next/link"
import { useState } from "react"
import { Mail, ArrowRight, CheckCircle } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useToast } from "@/hooks/use-toast"

export default function ForgotPassword() {
  const [step, setStep] = useState<"email" | "reset">("email")
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [resetCode, setResetCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const { addToast } = useToast()

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Simulate sending reset email
    setTimeout(() => {
      setIsLoading(false)
      addToast(`Password reset link sent to ${email}`, "success")
      setStep("reset")
    }, 1500)
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

    setIsLoading(true)

    setTimeout(() => {
      setIsLoading(false)
      addToast("Password successfully reset! Redirecting to login...", "success")
      setTimeout(() => {
        window.location.href = "/login"
      }, 1500)
    }, 1500)
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
                  <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-primary hover:opacity-90 transition rounded-lg text-primary-foreground font-medium flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <span>{isLoading ? "Sending..." : "Send Reset Link"}</span>
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
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="Enter code from email"
                    className="w-full px-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    required
                  />
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
