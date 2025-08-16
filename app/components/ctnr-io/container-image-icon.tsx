import React, { useState, useEffect, useMemo } from 'react'
import { Container } from 'lucide-react'

interface ContainerImageIconProps {
  image: string
  className?: string
}

// Persistent cache using localStorage with expiration
class ImageIconCache {
  private static readonly CACHE_KEY = 'container-image-icons'
  private static readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours
  
  private cache: Map<string, { available: boolean; url?: string; timestamp: number }>
  
  constructor() {
    this.cache = new Map()
    this.loadFromStorage()
  }
  
  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(ImageIconCache.CACHE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        const now = Date.now()
        
        // Filter out expired entries
        Object.entries(data).forEach(([key, value]: [string, any]) => {
          if (value.timestamp && (now - value.timestamp) < ImageIconCache.CACHE_EXPIRY) {
            this.cache.set(key, value)
          }
        })
      }
    } catch (error) {
      console.warn('Failed to load image icon cache:', error)
    }
  }
  
  private saveToStorage() {
    try {
      const data = Object.fromEntries(this.cache)
      localStorage.setItem(ImageIconCache.CACHE_KEY, JSON.stringify(data))
    } catch (error) {
      console.warn('Failed to save image icon cache:', error)
    }
  }
  
  get(key: string) {
    return this.cache.get(key)
  }
  
  set(key: string, value: { available: boolean; url?: string }) {
    this.cache.set(key, { ...value, timestamp: Date.now() })
    this.saveToStorage()
  }
  
  has(key: string) {
    return this.cache.has(key)
  }
}

// Global cache instance
const iconCache = new ImageIconCache()

// Parse image name once and memoize result
const parseImageName = (fullImage: string) => {
  // Remove registry (everything before the last /)
  const withoutRegistry = fullImage.split('/').pop() || fullImage
  // Remove tag (everything after :)
  const withoutTag = withoutRegistry.split(':')[0]
  
  // Check if it's an official image (no owner) or has owner
  const parts = withoutTag.split('/')
  if (parts.length === 1) {
    // Official image like "nginx", "node", "postgres"
    return { owner: null, imageName: parts[0].toLowerCase() }
  } else {
    // User/org image like "bitnami/nginx", "library/ubuntu"
    return { owner: parts[0].toLowerCase(), imageName: parts[1].toLowerCase() }
  }
}

// Generate simple hash for Gravatar
const generateHash = (str: string): string => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

// Get potential icon URLs in priority order
const getIconUrls = (owner: string | null, imageName: string): string[] => {
  const urls: string[] = []

  // 1. Try Gravatar for owner (Docker Hub style)
  if (owner) {
    const emailHash = generateHash(`${owner}@users.noreply.github.com`)
    urls.push(`https://www.gravatar.com/avatar/${emailHash}?s=64&d=404`)
  }

  // 2. Try Devicon for the image name
  urls.push(`https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${imageName}/${imageName}-original.svg`)

  // 3. Try alternative Devicon formats
  urls.push(`https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${imageName}/${imageName}-plain.svg`)

  return urls
}

export function ContainerImageIcon({ image, className = "h-4 w-4" }: ContainerImageIconProps) {
  const [forceUpdate, setForceUpdate] = useState(0)

  // Memoize parsed image data and cache key
  const { owner, imageName, cacheKey } = useMemo(() => {
    const parsed = parseImageName(image)
    return {
      ...parsed,
      cacheKey: `${parsed.owner || 'official'}/${parsed.imageName}`
    }
  }, [image])

  // Get iconUrl directly from cache
  const cached = iconCache.get(cacheKey)
  const iconUrl = cached?.available ? cached.url : null

  // Memoize icon URLs
  const testUrls = useMemo(() => getIconUrls(owner, imageName), [owner, imageName])

  useEffect(() => {
    // If already cached, no need to test
    if (cached) {
      return
    }

    // Test URLs in priority order
    const testNextUrl = (urlIndex: number) => {
      if (urlIndex >= testUrls.length) {
        // All URLs failed - cache the failure
        iconCache.set(cacheKey, { available: false })
        setForceUpdate(prev => prev + 1)
        return
      }

      const testImage = new Image()
      const currentUrl = testUrls[urlIndex]

      testImage.onload = () => {
        // Success - cache and use this URL directly
        iconCache.set(cacheKey, { available: true, url: currentUrl })
        setForceUpdate(prev => prev + 1)
      }

      testImage.onerror = () => {
        // Try next URL
        testNextUrl(urlIndex + 1)
      }

      testImage.src = currentUrl
    }

    // Start testing URLs
    testNextUrl(0)
  }, [cacheKey, testUrls, cached])

  // Use cache directly - no loading state needed
  if (!iconUrl) {
    return <Container className={`${className} text-muted-foreground`} />
  }

  return (
    <img
      src={iconUrl}
      alt={`${imageName} icon`}
      className={`${className} ${iconUrl.includes('gravatar') ? 'rounded' : ''}`}
      onError={() => {
        // Update cache directly and force re-render
        iconCache.set(cacheKey, { available: false })
        setForceUpdate(prev => prev + 1)
      }}
    />
  )
}
