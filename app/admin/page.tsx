"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useAuth } from "@/context/auth-context"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
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
  ArrowRight,
  Loader
} from "lucide-react"
import Link from "next/link"

interface AdminStats {
  totalDocuments: number
  totalSizeBytes: number
  uploadsThisWeek: number
  uploadsThisMonth: number
  totalEmployees: number
  activeEmployees: number
  newEmployeesThisMonth: number
  totalUploads: number
  growthRate: number
  totalDepartments: number
  departmentsWithFiles: number
  recentActivity: Array<{
    type: string
    subject: string
    department: string
    date: string
  }>
  fileTypes: Array<{
    file_type: string
    count: number
    total_size: number
  }>
  storageByProvider: Array<{
    storage_provider: string
    file_count: number
    total_bytes: number
  }>
}

export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.type !== "organization")) {
      router.push("/login")
    }
  }, [isAuthenticated, user, isLoading, router])

  useEffect(() => {
    if (isAuthenticated && user?.type === "organization") {
      fetchAdminStats()
    }
  }, [isAuthenticated, user])

  const fetchAdminStats = async () => {
    try {
      setStatsLoading(true)
      setError(null)
      
      const response = await fetch('/api/admin/dashboard/stats', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setStats(data.stats)
        } else {
          setError(data.error || 'Failed to load dashboard stats')
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to load dashboard stats')
      }
    } catch (error) {
      console.error('Error fetching admin stats:', error)
      setError('Network error. Please try again.')
    } finally {
      setStatsLoading(false)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'employee_joined':
        return 'bg-green-500'
      case 'document_uploaded':
        return 'bg-blue-500'
      case 'department_created':
        return 'bg-purple-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getActivityText = (activity: AdminStats['recentActivity'][0]) => {
    switch (activity.type) {
      case 'employee_joined':
        return `New employee joined: ${activity.subject}`
      case 'document_uploaded':
        return `Document uploaded: ${activity.subject}`
      case 'department_created':
        return `New department created: ${activity.subject}`
      default:
        return activity.subject
    }
  }

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
          {statsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="glass rounded-lg p-6 animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-1/3 mb-1"></div>
                  <div className="h-3 bg-muted rounded w-1/4"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="glass rounded-lg p-6 mb-8 border-red-500/20">
              <div className="text-center">
                <p className="text-red-400 mb-2">Failed to load dashboard stats</p>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <button
                  onClick={fetchAdminStats}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : stats ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="glass rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Documents</p>
                    <p className="text-2xl font-bold text-foreground">{stats.totalDocuments.toLocaleString()}</p>
                    <p className="text-xs text-green-400 mt-1">+{stats.uploadsThisWeek} this week</p>
                  </div>
                  <FileText className="w-8 h-8 text-primary/50" />
                </div>
              </div>

              <div className="glass rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Active Employees</p>
                    <p className="text-2xl font-bold text-foreground">{stats.activeEmployees}</p>
                    <p className="text-xs text-blue-400 mt-1">+{stats.newEmployeesThisMonth} this month</p>
                  </div>
                  <Users className="w-8 h-8 text-cyan-400/50" />
                </div>
              </div>

              <div className="glass rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Uploads</p>
                    <p className="text-2xl font-bold text-foreground">{stats.totalUploads.toLocaleString()}</p>
                    <p className="text-xs text-purple-400 mt-1">+{stats.uploadsThisMonth} this month</p>
                  </div>
                  <Upload className="w-8 h-8 text-green-500/50" />
                </div>
              </div>

              <div className="glass rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Growth Rate</p>
                    <p className="text-2xl font-bold text-foreground">
                      {stats.growthRate > 0 ? '+' : ''}{stats.growthRate}%
                    </p>
                    <p className="text-xs text-green-400 mt-1">vs last week</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-500/50" />
                </div>
              </div>
            </div>
          ) : null}

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
              {statsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-muted/20 rounded-lg animate-pulse">
                      <div className="w-2 h-2 bg-muted rounded-full mt-2"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-muted rounded w-3/4 mb-1"></div>
                        <div className="h-3 bg-muted rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : stats?.recentActivity && stats.recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentActivity.slice(0, 5).map((activity, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-muted/20 rounded-lg">
                      <div className={`w-2 h-2 ${getActivityIcon(activity.type)} rounded-full mt-2`}></div>
                      <div className="flex-1">
                        <p className="text-sm text-foreground">{getActivityText(activity)}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.department} • {new Date(activity.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">No recent activity</p>
                </div>
              )}
            </div>

            <div className="glass rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Storage Overview</h2>
              </div>
              {statsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg animate-pulse">
                      <div className="flex-1">
                        <div className="h-4 bg-muted rounded w-1/2 mb-1"></div>
                        <div className="h-3 bg-muted rounded w-1/3"></div>
                      </div>
                      <div className="h-4 bg-muted rounded w-16"></div>
                    </div>
                  ))}
                </div>
              ) : stats ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-foreground">Total Storage Used</p>
                      <p className="text-xs text-muted-foreground">{formatBytes(stats.totalSizeBytes)}</p>
                    </div>
                    <div className="text-primary text-sm font-medium">
                      {stats.totalDocuments} files
                    </div>
                  </div>
                  
                  {stats.storageByProvider.map((storage, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-foreground capitalize">{storage.storage_provider} Storage</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(storage.total_bytes)}</p>
                      </div>
                      <div className="text-primary text-sm font-medium">
                        {storage.file_count} files
                      </div>
                    </div>
                  ))}
                  
                  <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-foreground">Departments</p>
                      <p className="text-xs text-muted-foreground">{stats.departmentsWithFiles} with files</p>
                    </div>
                    <div className="text-primary text-sm font-medium">
                      {stats.totalDepartments} total
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}