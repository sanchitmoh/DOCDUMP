"use client"

import type React from "react"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useState } from "react"
import { Upload, FileUp, X, Lock, Shield, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { useToastContext } from "@/context/toast-context"

interface SecuritySettings {
  everyone: boolean
  management: boolean
  department: boolean
}

export default function UploadDocument() {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showOTPVerification, setShowOTPVerification] = useState(false)
  const [managementEmails, setManagementEmails] = useState("")
  const [selectedDepartment, setSelectedDepartment] = useState("")
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    department: "",
    tags: "",
    description: "",
  })
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    everyone: true,
    management: false,
    department: false,
  })

  const { showToast } = useToastContext()

  const allEmployees = [
    "John Smith (Engineering)",
    "Sarah Johnson (HR)",
    "Michael Chen (Finance)",
    "Emily Davis (Marketing)",
    "David Wilson (Sales)",
    "Lisa Anderson (Operations)",
    "James Martinez (Engineering)",
    "Jennifer Taylor (HR)",
    "Robert Brown (Finance)",
    "Amanda Lee (Marketing)",
  ]

  const filteredEmployees = allEmployees.filter((emp) => emp.toLowerCase().includes(employeeSearch.toLowerCase()))

  const departments = ["Engineering", "HR", "Finance", "Marketing", "Sales", "Operations"]

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(e.type === "dragenter" || e.type === "dragover")
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files?.[0]) {
      const droppedFile = e.dataTransfer.files[0]
      setFile(droppedFile)
      showToast(`File "${droppedFile.name}" selected for upload`, "info")
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)
      showToast(`File "${selectedFile.name}" selected for upload`, "info")
    }
  }

  const toggleEmployee = (employee: string) => {
    setSelectedEmployees((prev) => (prev.includes(employee) ? prev.filter((e) => e !== employee) : [...prev, employee]))
  }

  const handleSecurityChange = (key: keyof SecuritySettings) => {
    setSecuritySettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      showToast("Please select a file to upload", "error")
      return
    }

    if (!formData.title.trim()) {
      showToast("Please enter a document title", "error")
      return
    }

    if (!formData.category) {
      showToast("Please select a category", "error")
      return
    }

    if (securitySettings.management && !managementEmails.trim() && selectedEmployees.length === 0) {
      showToast("Please add email addresses or select employees for management access", "error")
      return
    }

    if (securitySettings.department && !selectedDepartment) {
      showToast("Please select a department", "error")
      return
    }

    setIsUploading(true)
    
    try {
      // Create FormData for file upload
      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('title', formData.title)
      uploadFormData.append('category', formData.category)
      uploadFormData.append('department', formData.department)
      uploadFormData.append('tags', formData.tags)
      uploadFormData.append('description', formData.description)
      
      // Add security settings
      uploadFormData.append('visibility', securitySettings.everyone ? 'org' : 'private')
      if (securitySettings.management) {
        uploadFormData.append('managementEmails', managementEmails)
        uploadFormData.append('selectedEmployees', JSON.stringify(selectedEmployees))
      }
      if (securitySettings.department) {
        uploadFormData.append('restrictedDepartment', selectedDepartment)
      }

      showToast("Uploading file...", "info", 5000)

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: uploadFormData,
      })

      const result = await response.json()

      if (response.ok && result.success) {
        showToast(`✅ File "${file.name}" uploaded successfully!`, "success", 5000)
        
        // Show additional info about processing
        if (result.extractionJobId) {
          showToast("📄 Text extraction started - you'll be notified when complete", "info", 4000)
        }
        
        if (result.searchIndexed) {
          showToast("🔍 Document indexed for search", "success", 3000)
        }

        // Reset form
        setFile(null)
        setFormData({ title: "", category: "", department: "", tags: "", description: "" })
        setSecuritySettings({ everyone: true, management: false, department: false })
        setManagementEmails("")
        setSelectedDepartment("")
        setEmployeeSearch("")
        setSelectedEmployees([])

        // Optionally redirect to the document or library
        // router.push(`/document/${result.fileId}`)
        
      } else {
        throw new Error(result.error || 'Upload failed')
      }

    } catch (error) {
      console.error('Upload error:', error)
      showToast(
        `❌ Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        "error", 
        6000
      )
    } finally {
      setIsUploading(false)
    }
  }

  const handleCancel = () => {
    setFile(null)
    setFormData({ title: "", category: "", department: "", tags: "", description: "" })
    setSecuritySettings({ everyone: true, management: false, department: false })
    setManagementEmails("")
    setSelectedDepartment("")
    setEmployeeSearch("")
    setSelectedEmployees([])
    showToast("Upload cancelled", "info")
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8">Upload Document</h1>

          <form onSubmit={handleUpload} className="space-y-6">
            {/* File Upload */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`glass rounded-lg p-12 text-center cursor-pointer transition border-2 border-dashed ${isDragging ? "border-primary bg-primary/10" : "border-border"}`}
            >
              {file ? (
                <div className="flex items-center justify-center space-x-4">
                  <FileUp className="w-8 h-8 text-primary" />
                  <div className="text-left">
                    <p className="font-medium text-foreground">{file.name}</p>
                    <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="ml-auto p-2 hover:bg-secondary rounded-lg transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="*"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="w-12 h-12 text-primary mx-auto mb-4" />
                    <p className="text-lg font-medium text-foreground mb-2">Drag and drop your file here</p>
                    <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
                  </label>
                </>
              )}
            </div>

            {/* Metadata */}
            <div className="glass rounded-lg p-6 space-y-4">
              <h2 className="font-semibold text-foreground">Document Information</h2>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Document title"
                  className="input-glass w-full"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="input-glass w-full"
                    required
                  >
                    <option value="">Select category</option>
                    <option value="policies">Policies</option>
                    <option value="hr">HR Documents</option>
                    <option value="training">Training</option>
                    <option value="research">Research</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="e.g., Engineering"
                    className="input-glass w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Tags</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="Comma-separated tags"
                  className="input-glass w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the document"
                  rows={4}
                  className="input-glass w-full"
                />
              </div>
            </div>

            <div
              className="rounded-lg p-6 space-y-4 border-l-4 border-cyan-500"
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                backdropFilter: "blur(64px)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderLeft: "4px solid rgb(6, 182, 212)",
              }}
            >
              <div className="flex items-center space-x-2 mb-4">
                <Shield className="w-5 h-5 text-cyan-400" />
                <h2 className="font-semibold text-foreground">Security & Access Control</h2>
              </div>

              <p className="text-sm text-muted-foreground">Who can open this document?</p>

              <div className="space-y-3">
                {/* Everyone */}
                <label className="flex items-center space-x-3 p-3 rounded-lg border border-white/10 hover:bg-white/5 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={securitySettings.everyone}
                    onChange={() => handleSecurityChange("everyone")}
                    className="w-4 h-4 rounded accent-cyan-500"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Everyone</p>
                    <p className="text-xs text-muted-foreground">Anyone in the organization can access</p>
                  </div>
                  <CheckCircle2
                    className={`w-5 h-5 ${securitySettings.everyone ? "text-cyan-500" : "text-muted-foreground"}`}
                  />
                </label>

                {/* Management Only */}
                <div className="space-y-2">
                  <label className="flex items-center space-x-3 p-3 rounded-lg border border-white/10 hover:bg-white/5 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={securitySettings.management}
                      onChange={() => handleSecurityChange("management")}
                      className="w-4 h-4 rounded accent-cyan-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Management Only</p>
                      <p className="text-xs text-muted-foreground">Only selected management can access with OTP</p>
                    </div>
                    {securitySettings.management && <Lock className="w-5 h-5 text-cyan-500" />}
                  </label>

                  {securitySettings.management && (
                    <div className="ml-7 p-4 bg-white/5 rounded-lg border border-white/10 space-y-3">
                      {/* Search & Select Employees */}
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Search & Select Employees
                        </label>
                        <input
                          type="text"
                          value={employeeSearch}
                          onChange={(e) => setEmployeeSearch(e.target.value)}
                          placeholder="Search employees..."
                          className="input-glass w-full text-sm mb-2"
                        />
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {filteredEmployees.length > 0 ? (
                            filteredEmployees.map((employee) => (
                              <label
                                key={employee}
                                className="flex items-center space-x-2 p-2 hover:bg-white/5 rounded cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedEmployees.includes(employee)}
                                  onChange={() => toggleEmployee(employee)}
                                  className="w-3 h-3 rounded accent-cyan-500"
                                />
                                <span className="text-sm text-foreground">{employee}</span>
                              </label>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground py-2">No employees found</p>
                          )}
                        </div>
                        {selectedEmployees.length > 0 && (
                          <p className="text-xs text-cyan-400 mt-2">{selectedEmployees.length} employee(s) selected</p>
                        )}
                      </div>

                      <label className="block text-sm font-medium text-foreground mt-4">Or add email addresses</label>
                      <textarea
                        value={managementEmails}
                        onChange={(e) => setManagementEmails(e.target.value)}
                        placeholder="manager@company.com&#10;director@company.com&#10;(one email per line)"
                        rows={3}
                        className="input-glass w-full text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter email addresses of management who can access this document
                      </p>
                    </div>
                  )}
                </div>

                {/* Department Only */}
                <div className="space-y-2">
                  <label className="flex items-center space-x-3 p-3 rounded-lg border border-white/10 hover:bg-white/5 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={securitySettings.department}
                      onChange={() => handleSecurityChange("department")}
                      className="w-4 h-4 rounded accent-cyan-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Department Only</p>
                      <p className="text-xs text-muted-foreground">Restricted to specific department members</p>
                    </div>
                    {securitySettings.department && <Lock className="w-5 h-5 text-cyan-500" />}
                  </label>

                  {securitySettings.department && (
                    <div className="ml-7 p-4 bg-white/5 rounded-lg border border-white/10">
                      <label className="block text-sm font-medium text-foreground mb-2">Select Department</label>
                      <select
                        value={selectedDepartment}
                        onChange={(e) => setSelectedDepartment(e.target.value)}
                        className="input-glass w-full"
                      >
                        <option value="">Choose a department</option>
                        {departments.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground mt-2">
                        Only members of the selected department can access this document
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Info alert */}
              {(securitySettings.management || securitySettings.department) && !securitySettings.everyone && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-200">
                    Restricted documents require recipients to verify with a 4-digit OTP sent to their registered email.
                  </p>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex space-x-4">
              <button 
                type="submit" 
                disabled={!file || isUploading} 
                className="button-primary flex-1 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Upload Document"
                )}
              </button>
              <button 
                type="button" 
                onClick={handleCancel}
                disabled={isUploading}
                className="button-glass px-6 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  )
}
