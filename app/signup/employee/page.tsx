"use client"

import type React from "react"

import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { Mail, Lock, User, Key, ArrowRight, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Captcha } from "@/components/captcha"
import { useRouter } from "next/navigation"

declare global {
  interface Window {
    gsap?: any
  }
}

export default function EmployeeSignup() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    orgCode: "",
    department: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [fetchedDepartments, setFetchedDepartments] = useState<string[]>([])
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "available" | "taken">("idle")
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([])
  const [captchaToken, setCaptchaToken] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { signUp } = useAuth()
  const { addToast } = useToast()
  const router = useRouter()
  const formRef = useRef<HTMLDivElement>(null)

  const inputWrapperClass =
    "group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition focus-within:border-purple-400/70 focus-within:shadow-[0_0_20px_rgba(147,51,234,0.25)]"
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

        window.gsap.from(formRef.current.querySelectorAll("input, select"), {
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

    // Cleanup debounce timeout on unmount
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  const checkEmailAvailability = async (email: string) => {
    if (!email || email.length < 3) {
      setEmailStatus("idle")
      setEmailSuggestions([])
      return
    }

    // Need organization code to check employee email
    if (!formData.orgCode || formData.orgCode.length !== 8) {
      setEmailStatus("idle")
      setEmailSuggestions([])
      return
    }

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    setEmailStatus("checking")

    // Debounce the API call by 500ms
    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch('/api/auth/check-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            userType: 'employee',
            orgCode: formData.orgCode,
          }),
        })

        const data = await response.json()

        if (response.ok && data.success) {
          if (data.available) {
            setEmailStatus("available")
            setEmailSuggestions([])
          } else {
            setEmailStatus("taken")
            setEmailSuggestions(data.suggestions || [])
          }
        } else {
          // Handle API errors gracefully
          setEmailStatus("idle")
          setEmailSuggestions([])
          if (data.error && data.error !== 'Organization code is required for employee email check') {
            addToast(data.error, "error")
          }
        }
      } catch (error) {
        console.error('Email check error:', error)
        setEmailStatus("idle")
        setEmailSuggestions([])
        addToast("Unable to check email availability", "error")
      }
    }, 500) // 500ms debounce delay
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value
    setFormData({ ...formData, email })
    checkEmailAvailability(email)
  }

  const handleCaptchaVerify = (token: string) => {
    setCaptchaToken(token)
  }

  const handleCaptchaError = (error: string) => {
    addToast(error, "error")
    setCaptchaToken("")
  }

  const handleOrgCodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const code = e.target.value.toUpperCase()
    setFormData({ ...formData, orgCode: code })

    if (code.length === 8) {
      try {
        // Fetch departments for this organization
        const response = await fetch('/api/auth/departments-by-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orgCode: code,
          }),
        })

        const data = await response.json()

        if (response.ok && data.success) {
          // Set departments from the organization
          setFetchedDepartments(data.departments)
          addToast(`Connected to ${data.organization.name}`, "success")
          
          // Re-check email availability with new org code (will be debounced)
          if (formData.email) {
            checkEmailAvailability(formData.email)
          }
        } else {
          // Invalid organization code
          setFetchedDepartments([])
          setFormData((prev) => ({ ...prev, department: "" }))
          setEmailStatus("idle")
          setEmailSuggestions([])
          addToast(data.error || "Invalid organization code", "error")
        }
      } catch (error) {
        console.error('Error fetching organization departments:', error)
        setFetchedDepartments([])
        setFormData((prev) => ({ ...prev, department: "" }))
        setEmailStatus("idle")
        setEmailSuggestions([])
        addToast("Unable to verify organization code", "error")
      }
    } else {
      // Reset when org code is not 8 characters
      setFetchedDepartments([])
      setFormData((prev) => ({ ...prev, department: "" }))
      // Reset email status when org code is invalid
      setEmailStatus("idle")
      setEmailSuggestions([])
      
      // Clear any pending debounced email check
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
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

    if (!formData.department) {
      addToast("Please select a department!", "error")
      return
    }

    if (!captchaToken) {
      addToast("Please complete the CAPTCHA verification", "error")
      return
    }

    setIsLoading(true)
    
    try {
      const result = await signUp(
        formData.email, 
        formData.password, 
        formData.fullName, 
        "employee", 
        {
          orgCode: formData.orgCode,
          department: formData.department,
        },
        captchaToken
      )

      if (result.success) {
        addToast(result.message, "success")
        // Store temp token for OTP verification
        localStorage.setItem("tempToken", result.tempToken || "")
        localStorage.setItem("signupEmail", formData.email)
        router.push("/verify-otp")
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
      <div className="fixed top-1/4 left-1/4 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl animate-pulse pointer-events-none"></div>
      <div className="fixed bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-pink-500/10 blur-3xl animate-pulse pointer-events-none [animation-delay:1s]"></div>

      {/* Header */}
      <header className="relative z-10 px-4 py-6 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-foreground">DocDump</h1>
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md" ref={formRef}>
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 mb-4 animate-pulse">
              <User className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
              Join as Employee
            </h1>
            <p className="text-muted-foreground">Access your organization's document library</p>
          </div>

          {/* Glass form container */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(64px)",
              border: "1px solid rgba(168, 85, 247, 0.3)",
              boxShadow: "0 20px 40px -10px rgba(168, 85, 247, 0.2)",
            }}
            className="rounded-2xl p-8 mb-6"
          >
            <form onSubmit={handleSignup} className="space-y-5">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Full Name</label>
                <div className={inputWrapperClass}>
                  <User className="w-5 h-5 text-purple-400/70 transition group-focus-within:text-purple-300" />
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Jane Smith"
                    className={textInputClass}
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-foreground">Email Address</label>
                  {emailStatus === "checking" && <span className="text-xs text-yellow-500 flex items-center gap-1">
                    <div className="w-3 h-3 border border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                    Checking...
                  </span>}
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
                  <Mail className="w-5 h-5 text-purple-400/70 transition group-focus-within:text-purple-300" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={handleEmailChange}
                    placeholder="jane@company.com"
                    className={textInputClass}
                    required
                  />
                </div>

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
                          className="w-full px-2 py-1 text-xs bg-purple-500/20 hover:bg-purple-500/30 transition text-purple-300 rounded text-left"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Organization Code */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Organization Code</label>
                <p className="text-xs text-muted-foreground mb-2">Ask your organization admin for this code</p>
                <div className={inputWrapperClass}>
                  <Key className="w-5 h-5 text-purple-400/70 transition group-focus-within:text-purple-300" />
                  <input
                    type="text"
                    value={formData.orgCode}
                    onChange={handleOrgCodeChange}
                    placeholder="ORG-12345"
                    className={textInputClass}
                    required
                  />
                </div>
              </div>

              {fetchedDepartments.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Department</label>
                  <p className="text-xs text-muted-foreground mb-2">Select your department in the organization</p>
                  <div className={inputWrapperClass}>
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className={`${textInputClass} appearance-none cursor-pointer`}
                      required
                    >
                      <option value="">Choose a department...</option>
                      {fetchedDepartments.map((dept, index) => (
                        <option key={index} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Password</label>
                <div className={inputWrapperClass}>
                  <Lock className="w-5 h-5 text-purple-400/70 transition group-focus-within:text-purple-300" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className={textInputClass}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-purple-400/70 hover:text-purple-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Minimum 8 characters</p>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Confirm Password</label>
                <div className={inputWrapperClass}>
                  <Lock className="w-5 h-5 text-purple-400/70 transition group-focus-within:text-purple-300" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                    className={textInputClass}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-purple-400/70 hover:text-purple-300 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* CAPTCHA */}
              <div className="py-2">
                <Captcha
                  onVerify={handleCaptchaVerify}
                  onError={handleCaptchaError}
                  action="register_employee"
                  theme="dark"
                />
              </div>

              <label className="flex items-start space-x-3 text-sm cursor-pointer group">
                <div className="relative top-0.5">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-white/20 bg-white/5 accent-purple-500"
                    required
                  />
                </div>
                <span className="text-muted-foreground group-hover:text-foreground transition">
                  I agree to the{" "}
                  <Link href="/terms" className="text-purple-400 hover:text-purple-300 transition">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-purple-400 hover:text-purple-300 transition">
                    Privacy Policy
                  </Link>
                </span>
              </label>

              <button
                type="submit"
                disabled={isLoading || emailStatus === "taken" || !captchaToken}
                style={{
                  background: "linear-gradient(135deg, rgba(168, 85, 247, 0.8) 0%, rgba(236, 72, 153, 0.8) 100%)",
                  boxShadow: "0 15px 30px rgba(168, 85, 247, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
                className="button-primary w-full flex items-center justify-center space-x-2 group disabled:opacity-50 py-3 rounded-lg text-white font-semibold transition"
              >
                <span>{isLoading ? "Creating account..." : "Join Organization"}</span>
                {!isLoading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />}
              </button>
            </form>
          </div>

          <p className="text-center text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent hover:opacity-80 transition font-semibold"
            >
              Sign in
            </Link>
          </p>

          {/* Trust indicators */}
          <div className="mt-8 space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-purple-500" />
              <span>Secure verification</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-purple-500" />
              <span>Instant access to org resources</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-purple-500" />
              <span>Privacy-first architecture</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
