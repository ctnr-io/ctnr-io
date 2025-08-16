import React, { useState, useEffect } from 'react'
import { Container } from 'lucide-react'

interface ContainerImageIconProps {
  image: string
  className?: string
}

// Simple image name parser
const getImageName = (fullImage: string): string => {
  // Remove registry and get just the image name
  const withoutRegistry = fullImage.split('/').pop() || fullImage
  // Remove tag
  const withoutTag = withoutRegistry.split(':')[0]
  return withoutTag.toLowerCase()
}

// Get icon URL for common images
const getIconUrl = (imageName: string): string | null => {
  // Try Devicon for common development tools
  return `https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${imageName}/${imageName}-original.svg`
}

export function ContainerImageIcon({ image, className = "h-4 w-4" }: ContainerImageIconProps) {
  const [iconUrl, setIconUrl] = useState<string | null>(null)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const imageName = getImageName(image)
    const url = getIconUrl(imageName)
    
    if (!url) {
      setHasError(true)
      return
    }

    // Test if the icon exists
    const testImage = new Image()
    testImage.onload = () => setIconUrl(url)
    testImage.onerror = () => setHasError(true)
    testImage.src = url
  }, [image])

  // Show fallback icon if no URL or error
  if (!iconUrl || hasError) {
    return <Container className={`${className} text-muted-foreground`} />
  }

  return (
    <img
      src={iconUrl}
      alt={`${getImageName(image)} icon`}
      className={className}
      onError={() => setHasError(true)}
    />
  )
}
