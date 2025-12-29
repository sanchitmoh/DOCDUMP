"use client"

import type React from "react"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useState } from "react"
import { Lock, Save, Eye, EyeOff } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"

export default function ChangePassword() {
  const { isAuthenticated } = useAuth()
  const { addToast } = useToast()
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="glass rounded-lg p-8 text-center">
            <p className="text-foreground font-medium">Please log in to change your password</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.newPassword !== formData.confirmPassword) {
      addToast("Passwords do not match", "error")
      return
    }

    if (formData.newPassword.length < 8) {
      addToast("Password must be at least 8 characters", "error")
      return
    }

    if (formData.currentPassword === formData.newPassword) {
      addToast("New password cannot be the same as current password", "error")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        addToast(data.message, "success")
        setFormData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        })
        setShowCurrentPassword(false)
        setShowNewPassword(false)
        setShowConfirmPassword(false)
        
        // Redirect to login after successful password change
        setTimeout(() => {
          window.location.href = "/login"
        }, 2000)
      } else {
        addToast(data.error || "Failed to change password", "error")
      }
    } catch (error) {
      console.error('Change password error:', error)
      addToast("Failed to change password. Please try again.", "error")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8">Change Password</h1>

          <div className="glass rounded-lg p-8">
            <form onSubmit={handleChangePassword} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2 flex items-center space-x-2">
                  <Lock className="w-4 h-4" />
                  <span>Current Password</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={formData.currentPassword}
                    onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 pr-12 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2 flex items-center space-x-2">
                  <Lock className="w-4 h-4" />
                  <span>New Password</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={formData.newPassword}
                    onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 pr-12 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                <label className="block text-sm font-medium text-foreground mb-2 flex items-center space-x-2">
                  <Lock className="w-4 h-4" />
                  <span>Confirm New Password</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 pr-12 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                className="w-full py-2 bg-primary hover:opacity-90 transition rounded-lg text-primary-foreground font-medium flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isLoading ? "Updating..." : "Change Password"}</span>
              </button>
            </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
