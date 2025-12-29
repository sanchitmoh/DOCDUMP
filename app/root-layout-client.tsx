"use client"

import type React from "react"
import { AIChatbox } from "@/components/ai-chatbox"
import { AuthProvider } from "@/context/auth-context"
import { VideoBackground } from "@/components/video-background"
import { ToastContainer } from "@/components/toast-container"
import { ToastProvider } from "@/context/toast-context"
import { useToast } from "@/hooks/use-toast"

function ToastContainerWrapper() {
  const { toasts, removeToast } = useToast()
  return <ToastContainer toasts={toasts} onRemove={removeToast} />
}

export function RootLayoutClient({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <AuthProvider>
      <ToastProvider>
        <VideoBackground />
        <AIChatbox />
        <div className="relative z-10">{children}</div>
        <ToastContainerWrapper />
      </ToastProvider>
    </AuthProvider>
  )
}
