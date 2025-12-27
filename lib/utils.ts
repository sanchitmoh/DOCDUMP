import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { NextRequest } from 'next/server'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extract client IP address from NextRequest headers
 * Handles various proxy and CDN headers
 * @param request - NextRequest object
 * @returns Client IP address or 'unknown' if not found
 */
export function getClientIP(request: NextRequest): string {
  // Check x-forwarded-for header (most common)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, get the first one (original client)
    return forwardedFor.split(',')[0].trim()
  }
  
  // Check other common headers
  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP.trim()
  }
  
  // Cloudflare specific header
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  if (cfConnectingIP) {
    return cfConnectingIP.trim()
  }
  
  // Fastly CDN header
  const fastlyClientIP = request.headers.get('fastly-client-ip')
  if (fastlyClientIP) {
    return fastlyClientIP.trim()
  }
  
  // AWS CloudFront header
  const cfViewerAddress = request.headers.get('cloudfront-viewer-address')
  if (cfViewerAddress) {
    return cfViewerAddress.trim()
  }
  
  // Fallback for development or when IP cannot be determined
  return 'unknown'
}

/**
 * Validate if an IP address is valid (IPv4 or IPv6)
 * @param ip - IP address string
 * @returns boolean indicating if IP is valid
 */
export function isValidIP(ip: string): boolean {
  if (ip === 'unknown') return false
  
  // IPv4 regex
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  
  // IPv6 regex (simplified)
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip)
}

/**
 * Get a safe client identifier for rate limiting
 * Uses IP address if valid, otherwise falls back to user-agent hash
 * @param request - NextRequest object
 * @returns Safe identifier string for rate limiting
 */
export function getClientIdentifier(request: NextRequest): string {
  const ip = getClientIP(request)
  
  if (isValidIP(ip)) {
    return ip
  }
  
  // Fallback to user-agent hash for rate limiting when IP is not available
  const userAgent = request.headers.get('user-agent') || 'unknown-agent'
  return `ua-${Buffer.from(userAgent).toString('base64').slice(0, 16)}`
}

/**
 * Creates a debounced version of a function
 * @param func - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function and cleanup function
 */
export function useDebounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): [T, () => void] {
  let timeoutId: NodeJS.Timeout | null = null

  const debouncedFunc = ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    
    timeoutId = setTimeout(() => {
      func(...args)
    }, delay)
  }) as T

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return [debouncedFunc, cleanup]
}
