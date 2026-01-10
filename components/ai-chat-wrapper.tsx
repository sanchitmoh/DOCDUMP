"use client"

import { EnhancedAIChatbox } from './enhanced-ai-chatbox'
import { useAIChat } from '@/hooks/use-ai-chat'
import { useFileContext } from '@/context/file-context'

export function AIChatWrapper() {
  const { user, isLoading, error } = useAIChat()
  const { selectedFileId, selectedFileName, setSelectedFile } = useFileContext()

  // Don't render if user is not authenticated
  if (isLoading) {
    return null // Or a loading spinner
  }

  if (error || !user) {
    return null // Or an error message
  }

  return (
    <EnhancedAIChatbox
      user={user}
      selectedFileId={selectedFileId}
      selectedFileName={selectedFileName}
      onFileSelect={setSelectedFile}
    />
  )
}