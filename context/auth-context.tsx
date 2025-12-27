"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect } from "react"
import { useRouter } from "next/navigation"

interface User {
  id: number
  name: string
  email: string
  type: "organization" | "employee"
  department?: string
  organization: {
    id: number
    name: string
    code: string
    logo?: string
    employeeCount?: number
    created_at?: string
  }
}

interface AuthContextType {
  isAuthenticated: boolean
  user: User | null
  isLoading: boolean
  signUp: (
    email: string,
    password: string,
    name: string,
    userType: "organization" | "employee",
    additionalData: any,
    captchaToken: string
  ) => Promise<{ success: boolean; message: string; tempToken?: string; error?: string }>
  verifyOTP: (otp: string, tempToken: string) => Promise<{ success: boolean; message: string; error?: string }>
  login: (email: string, password: string, captchaToken: string, rememberMe?: boolean) => Promise<{ success: boolean; message: string; error?: string; user?: User }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        setIsAuthenticated(true)
      } else {
        setUser(null)
        setIsAuthenticated(false)
      }
    } catch (error) {
      console.error('Auth check error:', error)
      setUser(null)
      setIsAuthenticated(false)
    } finally {
      setIsLoading(false)
    }
  }

  const signUp = async (
    email: string,
    password: string,
    name: string,
    userType: "organization" | "employee",
    additionalData: any,
    captchaToken: string
  ) => {
    try {
      const endpoint = userType === 'organization' 
        ? '/api/auth/register/organization'
        : '/api/auth/register/employee'

      const payload = {
        fullName: name,
        email,
        password,
        captchaToken,
        ...(userType === 'organization' 
          ? { organizationName: additionalData.organizationName }
          : { orgCode: additionalData.orgCode, department: additionalData.department }
        )
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok) {
        return {
          success: true,
          message: data.message,
          tempToken: data.tempToken,
        }
      } else {
        return {
          success: false,
          message: data.error || 'Registration failed',
          error: data.error,
        }
      }
    } catch (error) {
      console.error('Signup error:', error)
      return {
        success: false,
        message: 'Network error. Please try again.',
        error: 'Network error',
      }
    }
  }

  const verifyOTP = async (otp: string, tempToken: string) => {
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ otp, tempToken }),
      })

      const data = await response.json()

      if (response.ok) {
        return {
          success: true,
          message: data.message,
        }
      } else {
        return {
          success: false,
          message: data.error || 'Verification failed',
          error: data.error,
        }
      }
    } catch (error) {
      console.error('OTP verification error:', error)
      return {
        success: false,
        message: 'Network error. Please try again.',
        error: 'Network error',
      }
    }
  }

  const login = async (email: string, password: string, captchaToken: string, rememberMe: boolean = false) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password, captchaToken, rememberMe }),
      })

      const data = await response.json()

      if (response.ok) {
        setUser(data.user)
        setIsAuthenticated(true)
        return {
          success: true,
          message: data.message,
          user: data.user, // Return user data for immediate use
        }
      } else {
        return {
          success: false,
          message: data.error || 'Login failed',
          error: data.error,
        }
      }
    } catch (error) {
      console.error('Login error:', error)
      return {
        success: false,
        message: 'Network error. Please try again.',
        error: 'Network error',
      }
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setUser(null)
      setIsAuthenticated(false)
      router.push('/login')
    }
  }

  const refreshUser = async () => {
    await checkAuthStatus()
  }

  const value = {
    isAuthenticated,
    user,
    isLoading,
    signUp,
    verifyOTP,
    login,
    logout,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
