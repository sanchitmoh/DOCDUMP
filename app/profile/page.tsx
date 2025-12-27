"use client"

import type React from "react"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useState, useEffect } from "react"
import { Upload, Mail, Lock, Copy, Check, Calendar } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

export default function Profile() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()
  const { addToast } = useToast()
  const router = useRouter()
  const [copiedCode, setCopiedCode] = useState(false)
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    department: "",
    organizationName: "",
    organizationCode: "",
    memberSince: "",
  })
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(user?.organization?.logo || null)

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      console.log('Not authenticated, redirecting to login')
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  // Load employee profile data
  useEffect(() => {
    const loadProfile = async () => {
      // Wait for auth to finish loading
      if (authLoading) {
        return
      }
      
      // If user is not loaded yet after auth finished, something is wrong
      if (!user) {
        setIsLoading(false)
        return
      }
      
      // If user is organization, no need to fetch employee profile
      if (user.type === 'organization') {
        setIsLoading(false)
        return
      }
      
      // Only fetch employee profile for employee users
      if (user.type === 'employee') {
        try {
          const response = await fetch('/api/employee/profile')
          const data = await response.json()

          if (response.ok && data.success) {
            setFormData({
              fullName: data.profile.fullName || "",
              email: data.profile.email || "",
              department: data.profile.department || "No Department",
              organizationName: data.profile.organizationName || "",
              organizationCode: data.profile.organizationCode || "",
              memberSince: data.profile.memberSince ? new Date(data.profile.memberSince).toLocaleDateString() : "",
            })
          } else {
            addToast(data.error || "Failed to load profile", "error")
          }
        } catch (error) {
          console.error('Error loading profile:', error)
          addToast("Failed to load profile", "error")
        }
      }
      
      setIsLoading(false)
    }

    loadProfile()
  }, [user, authLoading, addToast])

  // Timeout fallback to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsLoading(false)
    }, 10000) // 10 second timeout

    return () => clearTimeout(timeout)
  }, [])

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const logoData = event.target?.result as string
        setLogoPreview(logoData)
        // TODO: Implement updateOrganizationLogo API call
        console.log("Updating organization logo:", logoData)
        addToast("Company logo uploaded successfully!", "success")
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      addToast("Avatar updated successfully!", "success")
    }
  }

  const copyOrgCode = () => {
    if (formData.organizationCode) {
      navigator.clipboard.writeText(formData.organizationCode)
      setCopiedCode(true)
      addToast("Organization code copied to clipboard!", "success")
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  const handleSaveProfile = async () => {
    if (!formData.fullName.trim()) {
      addToast("Full name is required", "error")
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/employee/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        addToast("Profile updated successfully!", "success")
        setIsEditing(false)
      } else {
        addToast(data.error || "Failed to update profile", "error")
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      addToast("Failed to update profile", "error")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar currentPage="profile" />

      <main className="flex-1 px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8">My Profile</h1>

          {isLoading ? (
            <div className="glass rounded-lg p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-4">Loading profile...</p>
            </div>
          ) : (
            <>
              {user?.type === "organization" && user?.organization && (
                <div className="glass rounded-lg p-8 mb-8">
                  <h2 className="text-2xl font-semibold text-foreground mb-6">Organization Details</h2>

                  <div className="flex flex-col items-center mb-8 pb-8 border-b border-border">
                    <div className="w-32 h-32 rounded-lg bg-card border-2 border-dashed border-primary/30 flex items-center justify-center mb-4 overflow-hidden">
                      {logoPreview ? (
                        <img
                          src={logoPreview || "/placeholder.svg"}
                          alt="Company Logo"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-4xl">🏢</span>
                      )}
                    </div>
                    <label className="cursor-pointer px-4 py-2 bg-primary hover:opacity-90 transition rounded-lg text-primary-foreground flex items-center space-x-2">
                      <Upload className="w-4 h-4" />
                      <span>Upload Company Logo</span>
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-foreground mb-2">Organization Name</label>
                    <input
                      type="text"
                      value={user?.organization?.name || ""}
                      disabled
                      className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground disabled:opacity-50"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-foreground mb-2">Organization Code</label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Share this code with employees to link their account to your organization
                    </p>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={user?.organization?.code || ""}
                        disabled
                        className="flex-1 px-4 py-2 bg-card border border-border rounded-lg text-foreground font-mono font-bold disabled:opacity-50"
                      />
                      <button
                        onClick={copyOrgCode}
                        className="px-4 py-2 bg-accent hover:opacity-90 transition rounded-lg text-accent-foreground flex items-center space-x-2"
                      >
                        {copiedCode ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {user?.type === "employee" && (
                <>
                  {/* Employee Avatar Section */}
                  <div className="glass rounded-lg p-8 mb-8 text-center">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary text-primary-foreground text-4xl mb-4">
                      👤
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground">{formData.fullName}</h2>
                    <p className="text-muted-foreground mb-2">{formData.department}</p>
                    <p className="text-sm text-muted-foreground">{formData.organizationName}</p>
                  </div>

                  {/* Organization Info for Employee */}
                  <div className="glass rounded-lg p-8 mb-8">
                    <h3 className="text-xl font-semibold text-foreground mb-6">Organization Details</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Organization Name</label>
                        <input
                          type="text"
                          value={formData.organizationName}
                          disabled
                          className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground disabled:opacity-50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Organization Code</label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={formData.organizationCode}
                            disabled
                            className="flex-1 px-4 py-2 bg-card border border-border rounded-lg text-foreground font-mono font-bold disabled:opacity-50"
                          />
                          <button
                            onClick={copyOrgCode}
                            className="px-4 py-2 bg-accent hover:opacity-90 transition rounded-lg text-accent-foreground flex items-center space-x-2"
                          >
                            {copiedCode ? (
                              <>
                                <Check className="w-4 h-4" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2 flex items-center space-x-2">
                          <Calendar className="w-4 h-4" />
                          <span>Member Since</span>
                        </label>
                        <input
                          type="text"
                          value={formData.memberSince}
                          disabled
                          className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Profile Information */}
                  <div className="glass rounded-lg p-8 space-y-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-semibold text-foreground">Profile Information</h3>
                      <button
                        onClick={() => {
                          if (isEditing) {
                            handleSaveProfile()
                          } else {
                            setIsEditing(true)
                          }
                        }}
                        disabled={isSaving}
                        className="px-4 py-2 bg-primary hover:opacity-90 transition rounded-lg text-primary-foreground text-sm font-medium disabled:opacity-50"
                      >
                        {isSaving ? "Saving..." : isEditing ? "Save" : "Edit"}
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Full Name</label>
                        <input
                          type="text"
                          value={formData.fullName}
                          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                          disabled={!isEditing}
                          className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground disabled:opacity-50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2 flex items-center space-x-2">
                          <Mail className="w-4 h-4" />
                          <span>Email</span>
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          disabled
                          className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground disabled:opacity-50"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Department</label>
                        <input
                          type="text"
                          value={formData.department}
                          disabled
                          className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground disabled:opacity-50"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Department is managed by your organization admin</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Security Section */}
              <div className="glass rounded-lg p-8 mt-8">
                <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center space-x-2">
                  <Lock className="w-5 h-5" />
                  <span>Security Settings</span>
                </h3>

                <a
                  href="/change-password"
                  className="block w-full py-2 px-4 bg-card border border-border hover:bg-secondary transition rounded-lg text-foreground font-medium text-left"
                >
                  Change Password
                </a>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
