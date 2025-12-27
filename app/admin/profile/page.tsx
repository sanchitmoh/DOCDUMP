"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useAuth } from "@/context/auth-context"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { 
  User, 
  Building2, 
  Mail, 
  Shield, 
  Calendar,
  Users,
  FileText,
  Settings,
  Camera,
  Save,
  ArrowLeft
} from "lucide-react"
import Link from "next/link"

export default function AdminProfile() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    organizationName: "",
  })

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.type !== "organization")) {
      router.push("/login")
    }
    
    if (user) {
      setFormData({
        fullName: user.name || "",
        email: user.email || "",
        organizationName: user.organization?.name || "",
      })
    }
  }, [isAuthenticated, user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted-foreground mt-4">Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated || user?.type !== "organization") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Shield className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
        <p className="text-muted-foreground mt-2">Only organization admins can access this page</p>
        <Link 
          href="/login" 
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
        >
          Go to Login
        </Link>
      </div>
    )
  }

  const handleSave = async () => {
    try {
      const response = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          fullName: formData.fullName,
          organizationName: formData.organizationName,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Update the user context with new data
        // Note: In a real app, you might want to refresh the auth context
        setIsEditing(false)
        // You could also trigger a page refresh or update the auth context here
        window.location.reload() // Simple approach to refresh user data
      } else {
        console.error('Profile update failed:', data.error)
        // You might want to show an error toast here
      }
    } catch (error) {
      console.error('Profile update error:', error)
      // You might want to show an error toast here
    }
  }

  const handleCancel = () => {
    setFormData({
      fullName: user?.name || "",
      email: user?.email || "",
      organizationName: user?.organization?.name || "",
    })
    setIsEditing(false)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link 
              href="/admin" 
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Admin Dashboard
            </Link>
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">Admin Profile</h1>
                <p className="text-muted-foreground">Manage your organization admin account</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Profile Card */}
            <div className="lg:col-span-1">
              <div className="glass rounded-lg p-6 text-center">
                <div className="relative inline-block mb-4">
                  <div className="w-24 h-24 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center text-2xl font-bold text-primary-foreground">
                    {user?.name?.[0]?.toUpperCase() || "A"}
                  </div>
                  <button className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:bg-primary/90 transition">
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-1">{user?.name}</h2>
                <p className="text-sm text-muted-foreground mb-2">{user?.email}</p>
                <div className="inline-flex items-center gap-1 px-3 py-1 bg-primary/20 text-primary rounded-full text-sm">
                  <Shield className="w-3 h-3" />
                  Organization Admin
                </div>
              </div>

              {/* Quick Stats */}
              <div className="glass rounded-lg p-6 mt-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Quick Stats</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="text-sm text-muted-foreground">Employees</span>
                    </div>
                    <span className="font-semibold text-foreground">{user?.organization?.employeeCount || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      <span className="text-sm text-muted-foreground">Documents</span>
                    </div>
                    <span className="font-semibold text-foreground">245</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="text-sm text-muted-foreground">Member Since</span>
                    </div>
                    <span className="font-semibold text-foreground">
                      {user?.organization?.created_at 
                        ? new Date(user.organization.created_at).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short' 
                          })
                        : 'Unknown'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Details */}
            <div className="lg:col-span-2">
              <div className="glass rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-foreground">Profile Information</h3>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
                    >
                      <Settings className="w-4 h-4" />
                      Edit Profile
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancel}
                        className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
                      >
                        <Save className="w-4 h-4" />
                        Save Changes
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  {/* Personal Information */}
                  <div>
                    <h4 className="text-md font-medium text-foreground mb-4 flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      Personal Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Full Name</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={formData.fullName}
                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                            className="w-full px-3 py-2 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                          />
                        ) : (
                          <p className="px-3 py-2 bg-muted/20 rounded-lg text-foreground">{user?.name}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
                        <p className="px-3 py-2 bg-muted/20 rounded-lg text-foreground">{user?.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">Email address cannot be changed</p>
                      </div>
                    </div>
                  </div>

                  {/* Organization Information */}
                  <div>
                    <h4 className="text-md font-medium text-foreground mb-4 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      Organization Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Organization Name</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={formData.organizationName}
                            onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                            className="w-full px-3 py-2 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                          />
                        ) : (
                          <p className="px-3 py-2 bg-muted/20 rounded-lg text-foreground">{user?.organization?.name}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Organization Code</label>
                        <p className="px-3 py-2 bg-muted/20 rounded-lg text-foreground font-mono">
                          {user?.organization?.code}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Organization code cannot be changed. Share this code with employees to join your organization.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Account Settings */}
                  <div>
                    <h4 className="text-md font-medium text-foreground mb-4 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-primary" />
                      Account Settings
                    </h4>
                    <div className="space-y-3">
                      <Link 
                        href="/change-password"
                        className="flex items-center justify-between p-3 bg-muted/20 rounded-lg hover:bg-muted/30 transition"
                      >
                        <div className="flex items-center gap-3">
                          <Shield className="w-4 h-4 text-primary" />
                          <div>
                            <p className="text-sm font-medium text-foreground">Change Password</p>
                            <p className="text-xs text-muted-foreground">Update your account password</p>
                          </div>
                        </div>
                        <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
                      </Link>
                      
                      <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Mail className="w-4 h-4 text-primary" />
                          <div>
                            <p className="text-sm font-medium text-foreground">Email Notifications</p>
                            <p className="text-xs text-muted-foreground">Manage notification preferences</p>
                          </div>
                        </div>
                        <button className="text-primary hover:text-primary/80 text-sm">
                          Configure
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}