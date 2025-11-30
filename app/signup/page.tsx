'use client'

import Link from 'next/link'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { useState, useEffect, useRef } from 'react'
import { Mail, Lock, User, ArrowRight, CheckCircle2, Zap } from 'lucide-react'
import { useAuth } from '@/context/auth-context'

declare global {
  interface Window {
    gsap?: any;
  }
}

export default function Signup() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { signUp } = useAuth()
  const formRef = useRef<HTMLDivElement | null>(null)
  const inputWrapperClass =
    'group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition focus-within:border-cyan-400/70 focus-within:shadow-[0_20px_50px_rgba(6,182,212,0.25)]'
  const textInputClass =
    'flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none border-none'

  useEffect(() => {
    setMounted(true)
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js'
    script.async = true
    script.onload = () => {
      if (window.gsap && formRef.current) {
        // Animate form elements on load
        window.gsap.from(formRef.current, {
          duration: 0.8,
          opacity: 0,
          y: 30,
          ease: 'power3.out'
        })
        
        // Stagger input animations
        window.gsap.from(formRef.current.querySelectorAll('input'), {
          duration: 0.6,
          opacity: 0,
          x: -20,
          stagger: 0.1,
          ease: 'back.out',
          delay: 0.4
        })
      }
    }
    document.head.appendChild(script)
  }, [])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match!')
      return
    }
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      signUp(formData.email, formData.password, formData.name)
    }, 1500)
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden relative">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-md" ref={formRef}>
          <div>
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 mb-4 animate-pulse">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
                Join DocDump
              </h1>
              <p className="text-muted-foreground">Create your account to explore premium documents</p>
            </div>

            {/* Glass form container */}
            <div className="glass-premium rounded-2xl p-8 mb-6">
              <form onSubmit={handleSignup} className="space-y-5">
                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Full Name</label>
                  <div className={inputWrapperClass}>
                    <User className="w-5 h-5 text-cyan-400/70 transition group-focus-within:text-cyan-300" />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="John Doe"
                      className={textInputClass}
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Email Address</label>
                  <div className={inputWrapperClass}>
                    <Mail className="w-5 h-5 text-cyan-400/70 transition group-focus-within:text-cyan-300" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="you@company.com"
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
                    <input type="checkbox" className="w-4 h-4 rounded border-white/20 bg-white/5 accent-cyan-500" required />
                  </div>
                  <span className="text-muted-foreground group-hover:text-foreground transition">
                    I agree to the <Link href="/terms" className="text-cyan-400 hover:text-cyan-300 transition">Terms of Service</Link> and <Link href="/privacy" className="text-cyan-400 hover:text-cyan-300 transition">Privacy Policy</Link>
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="button-primary w-full flex items-center justify-center space-x-2 group disabled:opacity-50"
                >
                  <span>{isLoading ? 'Creating account...' : 'Create Account'}</span>
                  {!isLoading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />}
                </button>
              </form>
            </div>

            <p className="text-center text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent hover:opacity-80 transition font-semibold">
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
        </div>
      </main>

      <Footer />
    </div>
  )
}
