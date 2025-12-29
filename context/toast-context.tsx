"use client"

import React, { createContext, useContext } from "react"
import { useToast, type ToastType } from "@/hooks/use-toast"

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => string
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts, addToast, removeToast } = useToast()

  const showToast = (message: string, type: ToastType = "info", duration = 3000) => {
    return addToast(message, type, duration)
  }

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToastContext() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error("useToastContext must be used within a ToastProvider")
  }
  return context
}