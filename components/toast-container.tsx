"use client"

import type { Toast } from "@/hooks/use-toast"
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react"

interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      default:
        return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  const getBgColor = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-500/10 border-green-500/30"
      case "error":
        return "bg-red-500/10 border-red-500/30"
      case "warning":
        return "bg-yellow-500/10 border-yellow-500/30"
      default:
        return "bg-blue-500/10 border-blue-500/30"
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm animate-in fade-in slide-in-from-right-5 duration-300 ${getBgColor(toast.type)}`}
        >
          {getIcon(toast.type)}
          <span className="text-sm text-foreground">{toast.message}</span>
          <button onClick={() => onRemove(toast.id)} className="ml-2 opacity-70 hover:opacity-100 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
