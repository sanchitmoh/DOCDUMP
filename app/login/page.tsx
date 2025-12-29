"use client"

import type React from "react"

import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Captcha } from "@/components/captcha"
import { useState } from "react"
import { Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [captchaToken, setCaptchaToken] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const { addToast } = useToast()
  const router = useRouter()

  const handleCaptchaVerify = (token: string) => {
    setCaptchaToken(token)
  }

  const handleCaptchaError = (error: string) => {
    addToast(error, "error")
    setCaptchaToken("")
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      addToast("Please fill in all fields", "error")
      return
    }

    if (!captchaToken) {
      addToast("Please complete the CAPTCHA verification", "error")
      return
    }

    setIsLoading(true)
    
    try {
      const result = await login(email, password, captchaToken, rememberMe)
      
      if (result.success) {
        addToast(result.message, "success")
        
        // Redirect based on user type
        if (result.user?.type === 'organization') {
          router.push("/admin")
        } else {
          router.push("/dashboard")
        }
      } else {
        addToast(result.message, "error")
        setCaptchaToken("") // Reset CAPTCHA on error
      }
    } catch (error) {
      addToast("An unexpected error occurred", "error")
      setCaptchaToken("")
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
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
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
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-12 py-3 bg-white/5 border border-white/10 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-primary bg-white/5 border-white/10 rounded focus:ring-primary/20"
                  />
                  <span className="text-sm text-muted-foreground">Remember me</span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              {/* CAPTCHA */}
              <div className="py-2">
                <Captcha
                  onVerify={handleCaptchaVerify}
                  onError={handleCaptchaError}
                  action="login"
                  theme="dark"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !captchaToken}
                className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center space-y-3">
              <p className="text-muted-foreground">
                <Link href="/forgot-password" className="text-primary hover:text-primary/80 transition-colors">
                  Forgot your password?
                </Link>
              </p>
              <p className="text-muted-foreground">
                Don't have an account?{" "}
                <Link href="/signup" className="text-primary hover:text-primary/80 transition-colors">
                  Sign up
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
