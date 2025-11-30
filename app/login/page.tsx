"use client"

import type React from "react"

import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useState } from "react"
import { Mail, Lock, ArrowRight } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const { addToast } = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      login(email, password)
      addToast("Login successful! Welcome back.", "success")
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="glass rounded-lg p-8 mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Welcome Back</h1>
            <p className="text-muted-foreground mb-8">Sign in to access your documents</p>

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Email</label>
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

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-border bg-card" />
                  <span className="text-muted-foreground">Remember me</span>
                </label>
                <Link href="/forgot-password" className="text-primary hover:text-accent transition">
                  Forgot password?
                </Link>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-primary hover:opacity-90 transition rounded-lg text-primary-foreground font-medium flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <span>{isLoading ? "Signing in..." : "Sign In"}</span>
                {!isLoading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-card text-muted-foreground">Or continue with</span>
              </div>
            </div>

            {/* Social Login */}
            <button className="w-full py-3 bg-card border border-border hover:bg-secondary transition rounded-lg text-foreground font-medium">
              Continue with SSO
            </button>
          </div>

          {/* Sign Up Link */}
          <p className="text-center text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/signup" className="text-primary hover:text-accent transition font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
