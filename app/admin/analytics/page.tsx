"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useAuth } from "@/context/auth-context"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
} from "recharts"
import { 
  Users, 
  FileText, 
  Upload, 
  TrendingUp, 
  Download, 
  Eye, 
  Share2, 
  Trash2,
  HardDrive,
  Clock,
  Activity,
  Database,
  Search,
  Zap,
  Filter,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
  RefreshCw
} from "lucide-react"

const COLORS = ["#06b6d4", "#0ea5e9", "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#f97316"]
const STORAGE_COLORS = ["#06b6d4", "#0ea5e9", "#6366f1"]

interface AnalyticsData {
  files: {
    total: number
    active: number
    deleted: number
    totalSize: string
    totalSizeBytes: number
    averageSize: string
    uniqueContributors: number
    departmentsWithFiles: number
    typeBreakdown: {
      images: number
      videos: number
      audio: number
      pdfs: number
      office: number
    }
    storageBreakdown: {
      s3: number
      local: number
      hybrid: number
    }
  }
  activity: {
    activeUsers: number
    totalActivities: number
    views: number
    downloads: number
    uploads: number
    shares: number
    deletions: number
    timeBreakdown: {
      last24Hours: number
      last7Days: number
      currentPeriod: number
    }
  }
  storage: Array<{
    type: string
    used: string
    usedBytes: number
    quota: string
    quotaBytes: number
    utilization: string
    fileCount: number
    averageFileSize: string
    maxFileSize: string
  }>
  textExtraction: Record<string, {
    total: number
    successful: number
    failed: number
    pending: number
    processing: number
    averageProcessingTime: number
    recentJobs: number
    averageWords: number
    averageConfidence: number
  }>
  searchIndexing: Record<string, {
    count: number
    recentlyIndexed: number
    averageDelay: number
  }>
  departments: Array<{
    name: string
    description: string
    fileCount: number
    totalSize: string
    totalSizeBytes: number
    contributors: number
    recentFiles: number
    views: number
    downloads: number
    userCount: number
  }>
  topContributors: Array<{
    id: number
    name: string
    email: string
    department: string
    filesContributed: number
    totalSize: string
    totalSizeBytes: number
    recentContributions: number
    filesViewed: number
    filesDownloaded: number
    lastContribution: string
    lastActivity: string
  }>
  accessPatterns?: {
    daily: Record<string, any>
    hourly: Record<string, number>
    byAction: Record<string, number>
  }
}

export default function Analytics() {
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState('30')
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [includeDetails, setIncludeDetails] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAnalytics = async () => {
    try {
      setRefreshing(true)

      const params = new URLSearchParams({
        period: selectedPeriod,
        ...(selectedDepartment && { department: selectedDepartment }),
        ...(includeDetails && { details: 'true' })
      })

      const response = await fetch(`/api/analytics/comprehensive?${params}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.statusText}`)
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch analytics')
      }

      setAnalyticsData(data)
      setError(null)
    } catch (err) {
      console.error('Analytics fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated && user?.type === 'organization') {
      fetchAnalytics()
    }
  }, [isAuthenticated, user, selectedPeriod, selectedDepartment, includeDetails])

  if (!isAuthenticated || user?.type !== "organization") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
        <p className="text-muted-foreground mt-2">Only organization admins can access this page</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 px-4 py-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading analytics...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 px-4 py-8 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <button 
              onClick={fetchAnalytics}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!analyticsData) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 px-4 py-8 flex items-center justify-center">
          <p className="text-muted-foreground">No analytics data available</p>
        </main>
        <Footer />
      </div>
    )
  }

  // Prepare chart data
  const fileTypeData = Object.entries(analyticsData.files.typeBreakdown).map(([type, count]) => ({
    name: type.charAt(0).toUpperCase() + type.slice(1),
    value: count
  })).filter(item => item.value > 0)

  const storageTypeData = Object.entries(analyticsData.files.storageBreakdown).map(([type, count]) => ({
    name: type.toUpperCase(),
    value: count
  })).filter(item => item.value > 0)

  const departmentData = analyticsData.departments.map(dept => ({
    name: dept.name,
    files: dept.fileCount,
    size: dept.totalSizeBytes,
    users: dept.userCount,
    views: dept.views,
    downloads: dept.downloads
  }))

  const activityData = [
    { name: 'Views', value: analyticsData.activity.views, color: '#06b6d4' },
    { name: 'Downloads', value: analyticsData.activity.downloads, color: '#0ea5e9' },
    { name: 'Uploads', value: analyticsData.activity.uploads, color: '#6366f1' },
    { name: 'Shares', value: analyticsData.activity.shares, color: '#8b5cf6' },
    { name: 'Deletions', value: analyticsData.activity.deletions, color: '#ec4899' }
  ].filter(item => item.value > 0)

  const textExtractionData = Object.entries(analyticsData.textExtraction).map(([method, stats]) => ({
    method: method.charAt(0).toUpperCase() + method.slice(1),
    total: stats.total,
    successful: stats.successful,
    failed: stats.failed,
    successRate: stats.total > 0 ? ((stats.successful / stats.total) * 100).toFixed(1) : '0'
  }))

  const hourlyActivityData = analyticsData.accessPatterns?.hourly ? 
    Object.entries(analyticsData.accessPatterns.hourly).map(([hour, count]) => ({
      hour: `${hour}:00`,
      activity: count
    })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour)) : []

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header with Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Organization Analytics</h1>
              <p className="text-muted-foreground">
                Comprehensive insights for {analyticsData.department} • Last {selectedPeriod} days
              </p>
            </div>
            
            <div className="flex flex-wrap gap-4 mt-4 lg:mt-0">
              {/* Period Filter */}
              <select 
                value={selectedPeriod} 
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-2 bg-card border border-border rounded-lg text-foreground"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last year</option>
              </select>

              {/* Department Filter */}
              <select 
                value={selectedDepartment} 
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-3 py-2 bg-card border border-border rounded-lg text-foreground"
              >
                <option value="">All Departments</option>
                {analyticsData.departments.map(dept => (
                  <option key={dept.name} value={dept.name}>{dept.name}</option>
                ))}
              </select>

              {/* Details Toggle */}
              <label className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg">
                <input 
                  type="checkbox" 
                  checked={includeDetails} 
                  onChange={(e) => setIncludeDetails(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-foreground">Detailed View</span>
              </label>

              {/* Refresh Button */}
              <button 
                onClick={fetchAnalytics}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="glass rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Documents</p>
                  <p className="text-2xl font-bold text-foreground">{analyticsData.files.total.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analyticsData.files.totalSize} • {analyticsData.files.uniqueContributors} contributors
                  </p>
                </div>
                <FileText className="w-8 h-8 text-primary/50" />
              </div>
            </div>

            <div className="glass rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Active Users</p>
                  <p className="text-2xl font-bold text-foreground">{analyticsData.activity.activeUsers.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analyticsData.activity.totalActivities.toLocaleString()} total activities
                  </p>
                </div>
                <Users className="w-8 h-8 text-cyan-400/50" />
              </div>
            </div>

            <div className="glass rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Views</p>
                  <p className="text-2xl font-bold text-foreground">{analyticsData.activity.views.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analyticsData.activity.downloads.toLocaleString()} downloads
                  </p>
                </div>
                <Eye className="w-8 h-8 text-green-500/50" />
              </div>
            </div>

            <div className="glass rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Storage Used</p>
                  <p className="text-2xl font-bold text-foreground">
                    {analyticsData.storage.reduce((acc, s) => acc + s.usedBytes, 0) > 0 ? 
                      analyticsData.storage[0]?.used || '0 B' : '0 B'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Across {analyticsData.storage.length} storage types
                  </p>
                </div>
                <HardDrive className="w-8 h-8 text-blue-500/50" />
              </div>
            </div>
          </div>

          {/* Activity Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="glass rounded-lg p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Activity Breakdown
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={activityData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value.toLocaleString()}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {activityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "rgba(15, 23, 41, 0.9)", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="glass rounded-lg p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <PieChartIcon className="w-5 h-5" />
                File Types Distribution
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={fileTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {fileTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "rgba(15, 23, 41, 0.9)", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Department Analytics */}
          <div className="glass rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Department Performance
            </h2>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={departmentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" />
                <YAxis stroke="rgba(255,255,255,0.5)" />
                <Tooltip
                  contentStyle={{ background: "rgba(15, 23, 41, 0.9)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
                <Legend />
                <Bar dataKey="files" fill="#06b6d4" name="Files" />
                <Bar dataKey="users" fill="#0ea5e9" name="Users" />
                <Bar dataKey="views" fill="#6366f1" name="Views" />
                <Bar dataKey="downloads" fill="#8b5cf6" name="Downloads" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Storage Analytics */}
          {analyticsData.storage.length > 0 && (
            <div className="glass rounded-lg p-6 mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Database className="w-5 h-5" />
                Storage Analytics
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {analyticsData.storage.map((storage, index) => (
                  <div key={storage.type} className="bg-card/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-foreground">{storage.type.toUpperCase()}</h3>
                      <span className="text-sm text-muted-foreground">{storage.utilization}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Used:</span>
                        <span className="text-foreground">{storage.used}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Files:</span>
                        <span className="text-foreground">{storage.fileCount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Avg Size:</span>
                        <span className="text-foreground">{storage.averageFileSize}</span>
                      </div>
                      {storage.quotaBytes > 0 && (
                        <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                          <div 
                            className="bg-primary h-2 rounded-full" 
                            style={{ width: storage.utilization }}
                          ></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Text Extraction Analytics */}
          {textExtractionData.length > 0 && (
            <div className="glass rounded-lg p-6 mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Text Extraction Performance
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={textExtractionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="method" stroke="rgba(255,255,255,0.5)" />
                  <YAxis stroke="rgba(255,255,255,0.5)" />
                  <Tooltip
                    contentStyle={{ background: "rgba(15, 23, 41, 0.9)", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                  <Legend />
                  <Bar dataKey="successful" fill="#10b981" name="Successful" />
                  <Bar dataKey="failed" fill="#ef4444" name="Failed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Hourly Activity Pattern */}
          {includeDetails && hourlyActivityData.length > 0 && (
            <div className="glass rounded-lg p-6 mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Hourly Activity Pattern
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={hourlyActivityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="hour" stroke="rgba(255,255,255,0.5)" />
                  <YAxis stroke="rgba(255,255,255,0.5)" />
                  <Tooltip
                    contentStyle={{ background: "rgba(15, 23, 41, 0.9)", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                  <Area type="monotone" dataKey="activity" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top Contributors */}
          {analyticsData.topContributors.length > 0 && (
            <div className="glass rounded-lg p-6 mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Top Contributors
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground">Name</th>
                      <th className="text-left py-2 text-muted-foreground">Department</th>
                      <th className="text-right py-2 text-muted-foreground">Files</th>
                      <th className="text-right py-2 text-muted-foreground">Size</th>
                      <th className="text-right py-2 text-muted-foreground">Views</th>
                      <th className="text-right py-2 text-muted-foreground">Downloads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyticsData.topContributors.slice(0, 10).map((contributor) => (
                      <tr key={contributor.id} className="border-b border-border/50">
                        <td className="py-3">
                          <div>
                            <p className="font-medium text-foreground">{contributor.name}</p>
                            <p className="text-sm text-muted-foreground">{contributor.email}</p>
                          </div>
                        </td>
                        <td className="py-3 text-foreground">{contributor.department}</td>
                        <td className="py-3 text-right text-foreground">{contributor.filesContributed.toLocaleString()}</td>
                        <td className="py-3 text-right text-foreground">{contributor.totalSize}</td>
                        <td className="py-3 text-right text-foreground">{contributor.filesViewed.toLocaleString()}</td>
                        <td className="py-3 text-right text-foreground">{contributor.filesDownloaded.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Quick Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass rounded-lg p-4 text-center">
              <Upload className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Uploads</p>
              <p className="text-xl font-bold text-foreground">{analyticsData.activity.uploads.toLocaleString()}</p>
            </div>
            <div className="glass rounded-lg p-4 text-center">
              <Download className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Downloads</p>
              <p className="text-xl font-bold text-foreground">{analyticsData.activity.downloads.toLocaleString()}</p>
            </div>
            <div className="glass rounded-lg p-4 text-center">
              <Share2 className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Shares</p>
              <p className="text-xl font-bold text-foreground">{analyticsData.activity.shares.toLocaleString()}</p>
            </div>
            <div className="glass rounded-lg p-4 text-center">
              <Search className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Departments</p>
              <p className="text-xl font-bold text-foreground">{analyticsData.departments.length}</p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
