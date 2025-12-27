"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useAuth } from "@/context/auth-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { 
  Users, 
  FileText, 
  Upload, 
  TrendingUp, 
  Settings, 
  BarChart3, 
  UserPlus, 
  Shield,
  Building2,
  Clock,
  ArrowRight
} from "lucide-react"
import Link from "next/link"

export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.type !== "organization")) {
      router.push("/login")
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-8 h-8 text-primary" />
              <h1 className="text-3xl font-bold text-foreground">
                Welcome back, {user?.name}!
              </h1>
            </div>
            <p className="text-muted-foreground">
              Manage your organization: <span className="text-foreground font-medium">{user?.organization?.name}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Organization Code: <span className="font-mono bg-muted px-2 py-1 rounded">{user?.organization?.code}</span>
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="glass rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Documents</p>
                  <p className="text-2xl font-bold text-foreground">245</p>
                  <p className="text-xs text-green-400 mt-1">+12 this week</p>
                </div>
                <FileText className="w-8 h-8 text-primary/50" />
              </div>
            </div>

            <div className="glass rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Active Employees</p>
                  <p className="text-2xl font-bold text-foreground">{user?.organization?.employeeCount || 0}</p>
                  <p className="text-xs text-blue-400 mt-1">+3 this month</p>
                </div>
                <Users className="w-8 h-8 text-cyan-400/50" />
              </div>
            </div>

            <div className="glass rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Uploads</p>
                  <p className="text-2xl font-bold text-foreground">428</p>
                  <p className="text-xs text-purple-400 mt-1">+18 this week</p>
                </div>
                <Upload className="w-8 h-8 text-green-500/50" />
              </div>
            </div>

            <div className="glass rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Growth Rate</p>
                  <p className="text-2xl font-bold text-foreground">+12.5%</p>
                  <p className="text-xs text-green-400 mt-1">vs last month</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-500/50" />
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link 
                href="/admin/people" 
                className="glass glow-hover rounded-lg p-6 group transition-all duration-200"
              >
                <div className="flex items-center gap-3 mb-2">
                  <UserPlus className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-foreground">Manage People</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Add employees, manage departments, and control access
                </p>
                <div className="flex items-center text-primary text-sm">
                  <span>Manage Team</span>
                  <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              <Link 
                href="/admin/analytics" 
                className="glass glow-hover rounded-lg p-6 group transition-all duration-200"
              >
                <div className="flex items-center gap-3 mb-2">
                  <BarChart3 className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-foreground">View Analytics</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Track usage, document stats, and organizational insights
                </p>
                <div className="flex items-center text-primary text-sm">
                  <span>View Reports</span>
                  <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              <Link 
                href="/upload" 
                className="glass glow-hover rounded-lg p-6 group transition-all duration-200"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Upload className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-foreground">Upload Documents</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Add new documents to your organization's library
                </p>
                <div className="flex items-center text-primary text-sm">
                  <span>Upload Files</span>
                  <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              <Link 
                href="/browse" 
                className="glass glow-hover rounded-lg p-6 group transition-all duration-200"
              >
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-foreground">Browse Library</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Explore and manage your document collection
                </p>
                <div className="flex items-center text-primary text-sm">
                  <span>Browse Files</span>
                  <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="glass rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-muted/20 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground">New employee joined: Sarah Johnson</p>
                    <p className="text-xs text-muted-foreground">Engineering Department • 2 hours ago</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/20 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground">Document uploaded: Q4 Financial Report</p>
                    <p className="text-xs text-muted-foreground">Finance Department • 4 hours ago</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/20 rounded-lg">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground">New department created: Customer Success</p>
                    <p className="text-xs text-muted-foreground">Organization Settings • 1 day ago</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Organization Settings</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-foreground">Organization Logo</p>
                    <p className="text-xs text-muted-foreground">Update your company branding</p>
                  </div>
                  <button className="text-primary hover:text-primary/80 text-sm">
                    Update
                  </button>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-foreground">Access Permissions</p>
                    <p className="text-xs text-muted-foreground">Manage document access levels</p>
                  </div>
                  <button className="text-primary hover:text-primary/80 text-sm">
                    Configure
                  </button>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-foreground">Backup Settings</p>
                    <p className="text-xs text-muted-foreground">Configure automatic backups</p>
                  </div>
                  <button className="text-primary hover:text-primary/80 text-sm">
                    Setup
                  </button>
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