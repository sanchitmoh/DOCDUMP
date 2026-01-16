// Integration route that forwards requests to the AI assistant module
import { NextRequest } from 'next/server'

// Import the AI assistant chat handler
export { POST, GET } from '@/ai-assistant/api/chat/route'
