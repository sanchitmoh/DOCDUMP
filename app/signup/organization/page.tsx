"use client"

import type React from "react"

import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { Mail, Lock, User, Building2, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"

declare global {
  interface Window {
    gsap?: any
  }
}

export default function OrganizationSignup() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    organizationName: "",
  })
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "available" | "taken">("idle")
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { signUp } = useAuth()
  const { addToast } = useToast()
  const formRef = useRef<HTMLDivElement>(null)

  const inputWrapperClass =
    "group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition focus-within:border-cyan-400/70 focus-within:shadow-[0_0_20px_rgba(6,182,212,0.25)]"
  const textInputClass =
    "flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none border-none"

  useEffect(() => {
    setMounted(true)
    const script = document.createElement("script")
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"
    script.async = true
    script.onload = () => {
      if (window.gsap && formRef.current) {
        window.gsap.from(formRef.current, {
          duration: 0.8,
          opacity: 0,
          y: 30,
          ease: "power3.out",
        })

        window.gsap.from(formRef.current.querySelectorAll("input"), {
          duration: 0.6,
          opacity: 0,
          x: -20,
          stagger: 0.1,
          ease: "back.out",
          delay: 0.4,
        })
      }
    }
    document.head.appendChild(script)
  }, [])

  const checkEmailAvailability = async (email: string) => {
    if (!email || email.length < 3) {
      setEmailStatus("idle")
      setEmailSuggestions([])
      return
    }

    setEmailStatus("checking")

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800))

    // Mock email availability check
    const takenEmails = ["admin@company.com", "user@company.com"]
    const isAvailable = !takenEmails.includes(email.toLowerCase())

    if (isAvailable) {
      setEmailStatus("available")
      setEmailSuggestions([])
    } else {
      setEmailStatus("taken")
      // Generate suggestions based on email
      const [name, domain] = email.split("@")
      const suggestions = [`${name}1@${domain}`, `${name}_official@${domain}`, `${name}.admin@${domain}`]
      setEmailSuggestions(suggestions)
    }
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value
    setFormData({ ...formData, email })
    checkEmailAvailability(email)
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()

    if (emailStatus === "taken") {
      addToast("Please use an available email address", "error")
      return
    }

    if (formData.password !== formData.confirmPassword) {
      addToast("Passwords do not match!", "error")
      return
    }

    if (formData.password.length < 8) {
      addToast("Password must be at least 8 characters", "error")
      return
    }

    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      signUp(formData.email, formData.password, formData.fullName, "organization", {
        organizationName: formData.organizationName,
      })
      addToast("Account created successfully! Please verify your email.", "success")
    }, 1500)
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden relative">
      {/* Video Background */}
      <div className="fixed inset-0 -z-10">
        <video
          autoPlay
          loop
          muted
          playsInline
          poster="/9669050-hd_1920_1080_25fps.jpg"
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        >
          <source src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/git-blob/prj_TDwCNRq5OCm7JqknFlu0yKdTg8KX/PoecfVyPu6uuv93Ojgwm3V/public/9669050-hd_1920_1080_25fps.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-background/95 via-background/90 to-background/95"></div>
      </div>

      {/* Animated gradient orbs */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl animate-pulse pointer-events-none"></div>
      <div className="fixed bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl animate-pulse pointer-events-none [animation-delay:1s]"></div>

      {/* Header */}
      <header className="relative z-10 px-4 py-6 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-foreground">DocDump</h1>
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md" ref={formRef}>
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 mb-4 animate-pulse">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
              Create Organization
            </h1>
            <p className="text-muted-foreground">Set up your company's digital library</p>
          </div>

          {/* Glass form container */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(64px)",
              border: "1px solid rgba(6, 182, 212, 0.3)",
              boxShadow: "0 20px 40px -10px rgba(6, 182, 212, 0.2)",
            }}
            className="rounded-2xl p-8 mb-6"
          >
            <form onSubmit={handleSignup} className="space-y-5">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Full Name</label>
                <div className={inputWrapperClass}>
                  <User className="w-5 h-5 text-cyan-400/70 transition group-focus-within:text-cyan-300" />
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="John Doe"
                    className={textInputClass}
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-foreground">Email Address</label>
                  {emailStatus === "checking" && <span className="text-xs text-yellow-500">Checking...</span>}
                  {emailStatus === "available" && (
                    <span className="text-xs text-green-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Available
                    </span>
                  )}
                  {emailStatus === "taken" && (
                    <span className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Taken
                    </span>
                  )}
                </div>
                <div className={inputWrapperClass}>
                  <Mail className="w-5 h-5 text-cyan-400/70 transition group-focus-within:text-cyan-300" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={handleEmailChange}
                    placeholder="you@company.com"
                    className={textInputClass}
                    required
                  />
                </div>

                {/* Email suggestions */}
                {emailSuggestions.length > 0 && (
                  <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-2">Try these alternatives:</p>
                    <div className="space-y-2">
                      {emailSuggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, email: suggestion })
                            checkEmailAvailability(suggestion)
                          }}
                          className="w-full px-2 py-1 text-xs bg-cyan-500/20 hover:bg-cyan-500/30 transition text-cyan-300 rounded text-left"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Organization Name */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Organization Name</label>
                <div className={inputWrapperClass}>
                  <Building2 className="w-5 h-5 text-cyan-400/70 transition group-focus-within:text-cyan-300" />
                  <input
                    type="text"
                    value={formData.organizationName}
                    onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                    placeholder="Your Company Inc."
                    className={textInputClass}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Password</label>
                <div className={inputWrapperClass}>
                  <Lock className="w-5 h-5 text-cyan-400/70 transition group-focus-within:text-cyan-300" />
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className={textInputClass}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Minimum 8 characters</p>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Confirm Password</label>
                <div className={inputWrapperClass}>
                  <Lock className="w-5 h-5 text-cyan-400/70 transition group-focus-within:text-cyan-300" />
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                    className={textInputClass}
                    required
                  />
                </div>
              </div>

              <label className="flex items-start space-x-3 text-sm cursor-pointer group">
                <div className="relative top-0.5">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-white/20 bg-white/5 accent-cyan-500"
                    required
                  />
                </div>
                <span className="text-muted-foreground group-hover:text-foreground transition">
                  I agree to the{" "}
                  <Link href="/terms" className="text-cyan-400 hover:text-cyan-300 transition">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-cyan-400 hover:text-cyan-300 transition">
                    Privacy Policy
                  </Link>
                </span>
              </label>

              <button
                type="submit"
                disabled={isLoading || emailStatus === "taken"}
                style={{
                  background: "linear-gradient(135deg, rgba(6, 182, 212, 0.8) 0%, rgba(59, 130, 246, 0.8) 100%)",
                  boxShadow: "0 15px 30px rgba(6, 182, 212, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
                className="button-primary w-full flex items-center justify-center space-x-2 group disabled:opacity-50 py-3 rounded-lg text-white font-semibold transition"
              >
                <span>{isLoading ? "Creating organization..." : "Create Organization"}</span>
                {!isLoading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />}
              </button>
            </form>
          </div>

          <p className="text-center text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent hover:opacity-80 transition font-semibold"
            >
              Sign in
            </Link>
          </p>

          {/* Trust indicators */}
          <div className="mt-8 space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-500" />
              <span>256-bit SSL encryption</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-500" />
              <span>Enterprise-grade security</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-500" />
              <span>Privacy-first architecture</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
