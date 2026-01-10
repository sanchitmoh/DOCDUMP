"use client"

import React, { createContext, useContext, useState } from 'react'

interface FileContextType {
  selectedFileId: string | null
  selectedFileName: string | null
  setSelectedFile: (fileId: string | null, fileName?: string | null) => void
}

const FileContext = createContext<FileContextType | undefined>(undefined)

export function FileProvider({ children }: { children: React.ReactNode }) {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)

  const setSelectedFile = (fileId: string | null, fileName?: string | null) => {
    setSelectedFileId(fileId)
    setSelectedFileName(fileName || null)
  }

  return (
    <FileContext.Provider value={{
      selectedFileId,
      selectedFileName,
      setSelectedFile
    }}>
      {children}
    </FileContext.Provider>
  )
}

export function useFileContext() {
  const context = useContext(FileContext)
  if (context === undefined) {
    throw new Error('useFileContext must be used within a FileProvider')
  }
  return context
}