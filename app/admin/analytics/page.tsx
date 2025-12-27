"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useAuth } from "@/context/auth-context"
import { useRouter } from "next/navigation"
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
} from "recharts"
import { Users, FileText, Upload, TrendingUp } from "lucide-react"

const documentStats = [
  { month: "Jan", uploads: 45, downloads: 120 },
  { month: "Feb", uploads: 52, downloads: 145 },
  { month: "Mar", uploads: 48, downloads: 130 },
  { month: "Apr", uploads: 61, downloads: 165 },
  { month: "May", uploads: 55, downloads: 150 },
  { month: "Jun", uploads: 67, downloads: 180 },
]

const documentByDepartment = [
  { name: "Engineering", value: 52 },
  { name: "HR", value: 28 },
  { name: "Finance", value: 35 },
  { name: "Marketing", value: 42 },
  { name: "Sales", value: 38 },
  { name: "Operations", value: 50 },
]

const accessControl = [
  { name: "Everyone", value: 35 },
  { name: "Management", value: 28 },
  { name: "Department", value: 37 },
]

const COLORS = ["#06b6d4", "#0ea5e9", "#6366f1"]
const DEPARTMENT_COLORS = ["#06b6d4", "#0ea5e9", "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b"]

export default function Analytics() {
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()

  if (!isAuthenticated || user?.type !== "organization") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
        <p className="text-muted-foreground mt-2">Only organization admins can access this page</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8">Organization Analytics</h1>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="glass rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Documents</p>
                  <p className="text-2xl font-bold text-foreground">245</p>
                </div>
                <FileText className="w-8 h-8 text-primary/50" />
              </div>
            </div>

            <div className="glass rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Active Users</p>
                  <p className="text-2xl font-bold text-foreground">89</p>
                </div>
                <Users className="w-8 h-8 text-cyan-400/50" />
              </div>
            </div>

            <div className="glass rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Uploads</p>
                  <p className="text-2xl font-bold text-foreground">428</p>
                </div>
                <Upload className="w-8 h-8 text-green-500/50" />
              </div>
            </div>

            <div className="glass rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Growth Rate</p>
                  <p className="text-2xl font-bold text-foreground">+12.5%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-500/50" />
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="glass rounded-lg p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Document Activity (Last 6 Months)</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={documentStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" />
                  <YAxis stroke="rgba(255,255,255,0.5)" />
                  <Tooltip
                    contentStyle={{ background: "rgba(15, 23, 41, 0.9)", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                  <Legend />
                  <Bar dataKey="uploads" fill="#06b6d4" name="Uploads" />
                  <Bar dataKey="downloads" fill="#0ea5e9" name="Downloads" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="glass rounded-lg p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Documents by Department</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={documentByDepartment} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis type="number" stroke="rgba(255,255,255,0.5)" />
                  <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.5)" width={100} />
                  <Tooltip
                    contentStyle={{ background: "rgba(15, 23, 41, 0.9)", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                  <Bar dataKey="value" fill="#06b6d4" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass rounded-lg p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Access Control Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={accessControl}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {accessControl.map((entry, index) => (
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
      </main>

      <Footer />
    </div>
  )
}
