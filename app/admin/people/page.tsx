"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useAuth } from "@/context/auth-context"
import { useState, useEffect } from "react"
import { Users, Mail, Trash2, ChevronLeft, ChevronRight } from "lucide-react"

interface Person {
  id: number
  name: string
  email: string
  department: string
  status: "active" | "inactive"
  joinDate: string
}

const ITEMS_PER_PAGE = 5

export default function People() {
  const { user, isAuthenticated } = useAuth()
  const [currentPage, setCurrentPage] = useState(1)
  const [newDepartment, setNewDepartment] = useState("")
  const [showAddDept, setShowAddDept] = useState(false)
  const [departments, setDepartments] = useState<string[]>([])
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true)
  const [people, setPeople] = useState<Person[]>([])
  const [isLoadingPeople, setIsLoadingPeople] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDepartment, setSelectedDepartment] = useState("All")

  // Fetch departments and people on component mount
  useEffect(() => {
    if (isAuthenticated && user?.type === "organization") {
      fetchDepartments()
      fetchPeople()
    }
  }, [isAuthenticated, user])

  const fetchPeople = async () => {
    try {
      setIsLoadingPeople(true)
      const response = await fetch('/api/admin/people', {
        credentials: 'include',
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setPeople(data.people)
        }
      }
    } catch (error) {
      console.error('Error fetching people:', error)
    } finally {
      setIsLoadingPeople(false)
    }
  }

  const fetchDepartments = async () => {
    try {
      setIsLoadingDepartments(true)
      const response = await fetch('/api/admin/departments', {
        credentials: 'include',
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setDepartments(data.departments.map((dept: any) => dept.name))
        }
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
    } finally {
      setIsLoadingDepartments(false)
    }
  }

  if (!isAuthenticated || user?.type !== "organization") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
        <p className="text-muted-foreground mt-2">Only organization admins can access this page</p>
      </div>
    )
  }

  const handleAddDepartment = async () => {
    if (newDepartment.trim()) {
      try {
        const response = await fetch('/api/admin/departments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            name: newDepartment.trim(),
          }),
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            // Refresh departments list
            await fetchDepartments()
            setNewDepartment("")
            setShowAddDept(false)
          }
        } else {
          const errorData = await response.json()
          console.error('Error creating department:', errorData.error)
        }
      } catch (error) {
        console.error('Error creating department:', error)
      }
    }
  }

  const totalPages = Math.ceil(people.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const currentPeople = people.slice(startIndex, endIndex)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
              <Users className="w-8 h-8 text-primary" />
              <span>Organization Members</span>
            </h1>
            <button className="button-primary px-6">Add Member</button>
          </div>

          <div className="mb-8 glass rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">Departments</h2>
              <button onClick={() => setShowAddDept(!showAddDept)} className="button-primary px-4 py-2 text-sm">
                + Add Department
              </button>
            </div>

            {showAddDept && (
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  placeholder="Enter department name"
                  className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  onKeyPress={(e) => e.key === "Enter" && handleAddDepartment()}
                />
                <button onClick={handleAddDepartment} className="button-primary px-4">
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddDept(false)
                    setNewDepartment("")
                  }}
                  className="px-4 py-2 rounded-lg border border-white/10 text-foreground hover:bg-white/5 transition"
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {isLoadingDepartments ? (
                <div className="px-4 py-2 bg-muted/20 rounded-full text-muted-foreground text-sm">
                  Loading departments...
                </div>
              ) : departments.length > 0 ? (
                departments.map((dept, index) => (
                  <div key={index} className="px-4 py-2 rounded-full bg-primary/20 text-primary text-sm font-medium">
                    {dept}
                  </div>
                ))
              ) : (
                <div className="px-4 py-2 bg-muted/20 rounded-full text-muted-foreground text-sm">
                  No departments created yet
                </div>
              )}
            </div>
          </div>

          {/* People Table */}
          <div className="glass rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Name</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Email</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Department</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Join Date</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPeople.map((person) => (
                    <tr key={person.id} className="border-b border-white/10 hover:bg-white/5 transition">
                      <td className="px-6 py-4 text-sm text-foreground">{person.name}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground flex items-center space-x-2">
                        <Mail className="w-4 h-4" />
                        <span>{person.email}</span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary">
                          {person.department}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            person.status === "active" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {person.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{person.joinDate}</td>
                      <td className="px-6 py-4 text-sm flex items-center space-x-2">
                        {/* Removed edit button, kept only delete */}
                        <button className="p-2 hover:bg-white/10 rounded-lg transition">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, people.length)} of {people.length} members
              </p>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-2 hover:bg-white/10 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 hover:bg-white/10 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
