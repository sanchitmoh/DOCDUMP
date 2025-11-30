"use client"

import type React from "react"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useState } from "react"
import { Upload, Mail, Phone, Lock, Copy, Check } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"

export default function Profile() {
  const { userType, organizationData, updateOrganizationLogo } = useAuth()
  const { addToast } = useToast()
  const [avatar, setAvatar] = useState("👤")
  const [copiedCode, setCopiedCode] = useState(false)
  const [formData, setFormData] = useState({
    name: "John Doe",
    email: "john@company.com",
    phone: "+1 (555) 123-4567",
    department: "Engineering",
  })
  const [isEditing, setIsEditing] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(organizationData?.logo || null)

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const logoData = event.target?.result as string
        setLogoPreview(logoData)
        updateOrganizationLogo(logoData)
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
    if (organizationData?.code) {
      navigator.clipboard.writeText(organizationData.code)
      setCopiedCode(true)
      addToast("Organization code copied to clipboard!", "success")
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  const handleSaveProfile = () => {
    addToast("Profile changes saved successfully!", "success")
    setIsEditing(false)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar currentPage="profile" />

      <main className="flex-1 px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8">My Profile</h1>

          {userType === "organization" && organizationData && (
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
                  value={organizationData.name}
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
                    value={organizationData.code}
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

          {/* Avatar Section */}
          <div className="glass rounded-lg p-8 mb-8 text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary text-primary-foreground text-4xl mb-4">
              {avatar}
            </div>
            <h2 className="text-2xl font-semibold text-foreground">{formData.name}</h2>
            <p className="text-muted-foreground mb-4">{formData.department}</p>
            <label className="inline-flex items-center space-x-2 px-4 py-2 bg-primary hover:opacity-90 transition rounded-lg text-primary-foreground cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Change Avatar</span>
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </label>
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
                className="px-4 py-2 bg-primary hover:opacity-90 transition rounded-lg text-primary-foreground text-sm font-medium"
              >
                {isEditing ? "Save" : "Edit"}
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground disabled:opacity-50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2 flex items-center space-x-2">
                  <Phone className="w-4 h-4" />
                  <span>Phone</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground disabled:opacity-50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 bg-card border border-border rounded-lg text-foreground disabled:opacity-50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

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
        </div>
      </main>

      <Footer />
    </div>
  )
}
