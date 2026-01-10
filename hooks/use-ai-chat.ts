import { useState } from 'react'
import { useAuth } from '@/context/auth-context'

interface User {
  id: number
  orgId: number
  name: string
  email: string
  type: 'employee' | 'organization'
}

interface UseAIChatReturn {
  user: User | null
  isLoading: boolean
  error: string | null
}

export function useAIChat(): UseAIChatReturn {
  const { user: authUser, isAuthenticated, isLoading: authLoading } = useAuth()
  const [error, setError] = useState<string | null>(null)

  // Transform auth user to AI chat user format
  const user: User | null = authUser && isAuthenticated ? {
    id: authUser.id,
    orgId: authUser.organization.id,
    name: authUser.name,
    email: authUser.email,
    type: authUser.type
  } : null

  return {
    user,
    isLoading: authLoading,
    error
  }
}