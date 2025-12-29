"use client"

import { useState } from "react"
import { CheckCircle, XCircle, RefreshCw, Database } from "lucide-react"

interface DatabaseStatus {
  success: boolean
  message: string
  status: string
  error?: string
}

export default function DatabaseSetup() {
  const [status, setStatus] = useState<DatabaseStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const testConnection = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/setup/database')
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      setStatus({
        success: false,
        message: 'Failed to test connection',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const initializeDatabase = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/setup/database', {
        method: 'POST'
      })
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      setStatus({
        success: false,
        message: 'Failed to initialize database',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="glass rounded-lg p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 mb-4">
              <Database className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Database Setup</h1>
            <p className="text-muted-foreground">Test and initialize your database connection</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={testConnection}
              disabled={isLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition rounded-lg text-white font-medium flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              <span>Test Connection</span>
            </button>

            <button
              onClick={initializeDatabase}
              disabled={isLoading}
              className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 transition rounded-lg text-white font-medium flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              <span>Initialize Database</span>
            </button>
          </div>

          {status && (
            <div className={`mt-6 p-4 rounded-lg border ${
              status.success 
                ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              <div className="flex items-center space-x-2 mb-2">
                {status.success ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                <span className="font-medium">{status.message}</span>
              </div>
              
              <div className="text-sm opacity-80">
                <p>Status: {status.status}</p>
                {status.error && <p>Error: {status.error}</p>}
              </div>
            </div>
          )}

          <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <h3 className="text-sm font-medium text-blue-400 mb-2">Database Configuration</h3>
            <div className="text-xs text-blue-300/80 space-y-1">
              <p>Host: {process.env.NEXT_PUBLIC_DB_HOST || 'localhost'}</p>
              <p>Port: {process.env.NEXT_PUBLIC_DB_PORT || '3306'}</p>
              <p>Database: {process.env.NEXT_PUBLIC_DB_NAME || 'Coprate_Digital_library'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}