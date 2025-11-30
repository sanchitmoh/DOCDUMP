"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect } from "react"
import { useRouter } from "next/navigation"

interface AuthContextType {
  isAuthenticated: boolean
  userEmail: string | null
  userType: "organization" | "employee" | null
  organizationData: {
    name: string
    code: string
    logo: string | null
    departments: string[]
  } | null
  userName: string | null
  signUp: (
    email: string,
    password: string,
    name: string,
    userType: "organization" | "employee",
    additionalData: any,
  ) => void
  sendOTP: (email: string) => void
  verifyOTP: (otp: string) => Promise<void>
  login: (email: string, password: string) => void
  logout: () => void
  updateOrganizationLogo: (logo: string) => void
  addDepartment: (department: string) => void
  generateOrgCode: () => string
  changePassword: (oldPassword: string, newPassword: string) => boolean
  resetPassword: (email: string, newPassword: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [userType, setUserType] = useState<"organization" | "employee" | null>(null)
  const [organizationData, setOrganizationData] = useState<{
    name: string
    code: string
    logo: string | null
    departments: string[]
  } | null>(null)
  const [tempEmail, setTempEmail] = useState<string | null>(null)
  const router = useRouter()

  const generateOrgCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase()
  }

  const addDepartment = (department: string) => {
    if (organizationData && department && !organizationData.departments.includes(department)) {
      const updatedDepartments = [...organizationData.departments, department]
      localStorage.setItem("organizationDepartments", JSON.stringify(updatedDepartments))
      setOrganizationData({
        ...organizationData,
        departments: updatedDepartments,
      })
    }
  }

  const signUp = (
    email: string,
    password: string,
    name: string,
    userType: "organization" | "employee",
    additionalData: any,
  ) => {
    setTempEmail(email)
    localStorage.setItem("signupEmail", email)
    localStorage.setItem("signupName", name)
    localStorage.setItem("signupPassword", password)
    localStorage.setItem("signupUserType", userType)

    if (userType === "organization") {
      const orgCode = generateOrgCode()
      localStorage.setItem("organizationName", additionalData.organizationName)
      localStorage.setItem("organizationCode", orgCode)
      localStorage.setItem("organizationLogo", "")
      localStorage.setItem("organizationDepartments", JSON.stringify(["General", "HR", "IT", "Marketing"]))
    } else {
      localStorage.setItem("orgCode", additionalData.orgCode)
      if (additionalData.department) {
        localStorage.setItem("employeeDepartment", additionalData.department)
      }
    }

    router.push("/verify-otp")
  }

  const sendOTP = (email: string) => {
    setTempEmail(email)
    localStorage.setItem("resetEmail", email)
  }

  const verifyOTP = (otp: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (otp && tempEmail) {
        localStorage.setItem("otpVerified", "true")
        resolve()
      } else {
        reject(new Error("Invalid OTP or email"))
      }
    })
  }

  const login = (email: string, password: string) => {
    const otpVerified = localStorage.getItem("otpVerified") === "true"
    if (!otpVerified) {
      alert("Please verify your email first")
      return
    }

    setIsAuthenticated(true)
    setUserEmail(email)
    setUserName(localStorage.getItem("signupName"))

    const savedUserType = localStorage.getItem("signupUserType") as "organization" | "employee" | null
    setUserType(savedUserType)

    if (savedUserType === "organization") {
      const departments = JSON.parse(
        localStorage.getItem("organizationDepartments") || '["General", "HR", "IT", "Marketing"]',
      )
      setOrganizationData({
        name: localStorage.getItem("organizationName") || "",
        code: localStorage.getItem("organizationCode") || "",
        logo: localStorage.getItem("organizationLogo") || null,
        departments,
      })
    }

    localStorage.setItem("isAuthenticated", "true")
    localStorage.setItem("userEmail", email)
    router.push("/")
  }

  const changePassword = (oldPassword: string, newPassword: string): boolean => {
    const storedPassword = localStorage.getItem("signupPassword")
    if (storedPassword === oldPassword) {
      localStorage.setItem("signupPassword", newPassword)
      return true
    }
    return false
  }

  const resetPassword = (email: string, newPassword: string): boolean => {
    const storedEmail = localStorage.getItem("signupEmail")
    if (storedEmail === email) {
      localStorage.setItem("signupPassword", newPassword)
      localStorage.removeItem("resetEmail")
      localStorage.removeItem("otpVerified")
      return true
    }
    return false
  }

  const updateOrganizationLogo = (logo: string) => {
    localStorage.setItem("organizationLogo", logo)
    if (organizationData) {
      setOrganizationData({
        ...organizationData,
        logo,
      })
    }
  }

  const logout = () => {
    setIsAuthenticated(false)
    setUserEmail(null)
    setUserName(null)
    setUserType(null)
    setOrganizationData(null)
    localStorage.removeItem("isAuthenticated")
    localStorage.removeItem("userEmail")
    localStorage.removeItem("otpVerified")
    localStorage.removeItem("signupEmail")
    localStorage.removeItem("signupUserType")
    localStorage.removeItem("organizationName")
    localStorage.removeItem("organizationCode")
    localStorage.removeItem("organizationLogo")
    localStorage.removeItem("organizationDepartments")
    localStorage.removeItem("employeeDepartment")
    localStorage.removeItem("resetEmail")
    router.push("/signup")
  }

  useEffect(() => {
    const isAuth = localStorage.getItem("isAuthenticated") === "true"
    if (isAuth) {
      setIsAuthenticated(true)
      setUserEmail(localStorage.getItem("userEmail"))
      setUserName(localStorage.getItem("signupName"))

      const savedUserType = localStorage.getItem("signupUserType") as "organization" | "employee" | null
      setUserType(savedUserType)

      if (savedUserType === "organization") {
        const departments = JSON.parse(
          localStorage.getItem("organizationDepartments") || '["General", "HR", "IT", "Marketing"]',
        )
        setOrganizationData({
          name: localStorage.getItem("organizationName") || "",
          code: localStorage.getItem("organizationCode") || "",
          logo: localStorage.getItem("organizationLogo") || null,
          departments,
        })
      }
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        userEmail,
        userName,
        userType,
        organizationData,
        signUp,
        sendOTP,
        verifyOTP,
        login,
        logout,
        updateOrganizationLogo,
        addDepartment,
        generateOrgCode,
        changePassword,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
