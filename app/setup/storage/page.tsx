"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CheckCircle, AlertCircle, Settings, Loader2 } from "lucide-react"

export default function StorageSetup() {
  const { user, isAuthenticated } = useAuth()
  const { addToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [storageConfig, setStorageConfig] = useState<any>(null)
  const [needsSetup, setNeedsSetup] = useState(false)

  useEffect(() => {
    if (isAuthenticated && user) {
      checkStorageConfig()
    }
  }, [isAuthenticated, user])

  const checkStorageConfig = async () => {
    try {
      setChecking(true)
      const response = await fetch('/api/storage/setup', {
        credentials: 'include'
      })

      const data = await response.json()
      
      if (data.success) {
        setStorageConfig(data.config)
        setNeedsSetup(false)
      } else {
        setNeedsSetup(data.needsSetup || true)
      }
    } catch (error) {
      console.error('Error checking storage config:', error)
      setNeedsSetup(true)
    } finally {
      setChecking(false)
    }
  }

  const setupStorage = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/storage/setup', {
        method: 'POST',
        credentials: 'include'
      })

      const data = await response.json()
      
      if (data.success) {
        addToast('Storage configuration created successfully!', 'success')
        setStorageConfig(data.config)
        setNeedsSetup(false)
      } else {
        addToast(data.error || 'Failed to set up storage', 'error')
      }
    } catch (error) {
      console.error('Error setting up storage:', error)
      addToast('Failed to set up storage configuration', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="glass rounded-lg p-8 text-center">
            <p className="text-foreground font-medium">Please log in to access storage setup</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (user?.type !== 'organization') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="glass rounded-lg p-8 text-center">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <p className="text-foreground font-medium">Only organization admins can access storage setup</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Storage Configuration</h1>
            <p className="text-muted-foreground">Set up and manage your organization's file storage</p>
          </div>

          {checking ? (
            <div className="glass rounded-lg p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-foreground">Checking storage configuration...</p>
            </div>
          ) : needsSetup ? (
            <div className="glass rounded-lg p-8">
              <div className="text-center mb-6">
                <Settings className="w-16 h-16 text-primary mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-foreground mb-2">Storage Setup Required</h2>
                <p className="text-muted-foreground">
                  Your organization needs a storage configuration to upload and manage files.
                </p>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-foreground mb-2">What will be configured:</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Hybrid storage (S3 + Local backup)</li>
                  <li>• File size limits and allowed types</li>
                  <li>• Storage quota and usage tracking</li>
                  <li>• Automatic text extraction and indexing</li>
                </ul>
              </div>

              <button
                onClick={setupStorage}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:opacity-90 transition rounded-lg text-primary-foreground font-medium disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Setting up storage...
                  </>
                ) : (
                  <>
                    <Settings className="w-5 h-5" />
                    Set Up Storage Configuration
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="glass rounded-lg p-8">
              <div className="text-center mb-6">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-foreground mb-2">Storage Configured</h2>
                <p className="text-muted-foreground">
                  Your organization's storage is properly configured and ready to use.
                </p>
              </div>

              {storageConfig && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-white/5 rounded-lg p-4">
                    <h3 className="font-semibold text-foreground mb-2">Storage Type</h3>
                    <p className="text-muted-foreground capitalize">{storageConfig.storage_type}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4">
                    <h3 className="font-semibold text-foreground mb-2">Max File Size</h3>
                    <p className="text-muted-foreground">
                      {Math.round(storageConfig.max_file_size_bytes / 1024 / 1024)} MB
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4">
                    <h3 className="font-semibold text-foreground mb-2">Storage Quota</h3>
                    <p className="text-muted-foreground">
                      {Math.round(storageConfig.storage_quota_bytes / 1024 / 1024 / 1024)} GB
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4">
                    <h3 className="font-semibold text-foreground mb-2">Used Space</h3>
                    <p className="text-muted-foreground">
                      {Math.round(storageConfig.storage_used_bytes / 1024 / 1024)} MB
                    </p>
                  </div>
                </div>
              )}

              <div className="text-center">
                <button
                  onClick={() => window.location.href = '/library'}
                  className="px-6 py-2 bg-primary hover:opacity-90 transition rounded-lg text-primary-foreground font-medium"
                >
                  Go to Library
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}