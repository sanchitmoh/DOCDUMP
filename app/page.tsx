'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { BookOpen, Users, Shield, Zap, ArrowRight } from 'lucide-react'

declare global {
  interface Window {
    gsap?: any;
  }
}

export default function Intro() {
  const { isAuthenticated, user, isLoading } = useAuth()
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      // Redirect based on user type
      if (user.type === 'organization') {
        router.push('/admin')
      } else {
        router.push('/dashboard')
      }
    }
    setMounted(true)

    // Load GSAP
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js'
    script.async = true
    script.onload = () => {
      if (window.gsap && containerRef.current) {
        const gsap = window.gsap
        
        // Animate hero section
        gsap.from(containerRef.current.querySelector('.hero-title'), {
          duration: 1,
          opacity: 0,
          y: 40,
          ease: 'power3.out'
        })

        gsap.from(containerRef.current.querySelector('.hero-description'), {
          duration: 1,
          opacity: 0,
          y: 20,
          ease: 'power3.out',
          delay: 0.2
        })

        // Animate signup cards
        gsap.from(containerRef.current.querySelectorAll('.signup-card'), {
          duration: 0.8,
          opacity: 0,
          y: 30,
          stagger: 0.2,
          ease: 'back.out',
          delay: 0.4
        })

        // Floating animation for feature icons
        gsap.from(containerRef.current.querySelectorAll('.feature-icon'), {
          duration: 2,
          y: 10,
          opacity: 0.8,
          stagger: 0.15,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut'
        })
      }
    }
    document.head.appendChild(script)
  }, [isAuthenticated, router])

  if (!isAuthenticated && !mounted) return null

  return (
    <div className="min-h-screen bg-background overflow-hidden" ref={containerRef}>
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

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="px-4 py-6 md:px-8 md:py-8">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">DocDump</h1>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition">Features</a>
              <a href="#about" className="text-muted-foreground hover:text-foreground transition">About</a>
              <Link href="/login" className="px-6 py-2 rounded-lg border border-white/20 text-foreground hover:bg-white/5 transition">
                Log In
              </Link>
            </nav>
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1 px-4 md:px-8 py-12 md:py-24 flex flex-col items-center justify-center">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="hero-title text-5xl md:text-6xl font-bold text-foreground mb-6">
              Centralize Your <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Corporate Knowledge</span>
            </h2>
            <p className="hero-description text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              DocDump is your enterprise digital library. Organize, search, and share critical documents across your entire organization with ease.
            </p>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 mb-16">
              <div className="glass p-6 rounded-xl text-center">
                <div className="feature-icon inline-flex items-center justify-center w-12 h-12 rounded-lg bg-cyan-500/20 mb-4">
                  <Shield className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Secure</h3>
                <p className="text-sm text-muted-foreground">Enterprise-grade security for your sensitive documents</p>
              </div>
              <div className="glass p-6 rounded-xl text-center">
                <div className="feature-icon inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-500/20 mb-4">
                  <Zap className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Fast Search</h3>
                <p className="text-sm text-muted-foreground">Find documents in seconds with powerful search</p>
              </div>
              <div className="glass p-6 rounded-xl text-center">
                <div className="feature-icon inline-flex items-center justify-center w-12 h-12 rounded-lg bg-purple-500/20 mb-4">
                  <Users className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Collaborate</h3>
                <p className="text-sm text-muted-foreground">Easy sharing and collaboration tools</p>
              </div>
            </div>

            {/* Signup Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
              {/* Organization Signup */}
              <Link href="/signup/organization">
                <div className="signup-card glass glow-hover p-8 rounded-2xl h-full cursor-pointer transform hover:scale-105 transition">
                  <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">Organization Sign Up</h3>
                  <p className="text-muted-foreground mb-6">Create your organization's digital library and manage your company's knowledge base.</p>
                  <div className="flex items-center justify-center space-x-2 text-cyan-400 group">
                    <span>Get Started</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
                  </div>
                </div>
              </Link>

              {/* Employee Signup */}
              <Link href="/signup/employee">
                <div className="signup-card glass glow-hover p-8 rounded-2xl h-full cursor-pointer transform hover:scale-105 transition">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">Employee Sign Up</h3>
                  <p className="text-muted-foreground mb-6">Join your organization and access all shared documents, policies, and corporate resources.</p>
                  <div className="flex items-center justify-center space-x-2 text-purple-400 group">
                    <span>Get Started</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="px-4 md:px-8 py-8 border-t border-white/10">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between">
            <p className="text-muted-foreground text-sm mb-4 md:mb-0">© 2025 DocDump. All rights reserved.</p>
            <div className="flex items-center space-x-6">
              <a href="#" className="footer-link text-muted-foreground hover:text-foreground transition">Privacy</a>
              <a href="#" className="footer-link text-muted-foreground hover:text-foreground transition">Terms</a>
              <a href="#" className="footer-link text-muted-foreground hover:text-foreground transition">Contact</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
