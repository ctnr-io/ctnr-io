'use dom'

import { Button } from 'app/components/shadcn/ui/button.tsx'
import { Download, Pause, Play, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTRPC } from 'driver/trpc/client/expo/mod.tsx'
import { useSubscription } from '@trpc/tanstack-react-query'

interface ContainerInstance {
  name: string
  status: string
}

interface ContainerLogsProps {
  containerName: string
  replicas?: ContainerInstance[]
}

export function ContainerLogs({ containerName, replicas }: ContainerLogsProps) {
  const [selectedReplica, setSelectedReplica] = useState<string>(replicas?.[0]?.name!)
  const [logs, setLogs] = useState<string[]>([])
  const [isStreaming, setIsStreaming] = useState(true)
  const [autoScroll, setAutoScroll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const logsContainerRef = useRef<HTMLDivElement>(null)

  const trpc = useTRPC()

  // Logs subscription for streaming
  const logsSubscription = useSubscription(
    trpc.core.logs.subscriptionOptions({
      name: containerName,
      follow: isStreaming,
      replica: selectedReplica ? [selectedReplica] : undefined,
      timestamps: true,
      tail: 100, // Show last 100 lines initially
    }, {
      enabled: isStreaming,
      onData: (data: { type: 'yield' | 'return'; value?: string }) => {
        if (data.type === 'yield' && data.value) {
          setLogs((prev) => [...prev, data.value!])
          setError(null)
        } else if (data.type === 'return') {
          setIsStreaming(false)
        }
      },
      onError: (err: any) => {
        setError(err.message || 'An error occurred while streaming logs')
        setIsStreaming(false)
        setIsLoading(false)
      },
    }),
  )

  // Reset logs when replica changes
  useEffect(() => {
    setLogs([])
    setError(null)
    if (selectedReplica && isStreaming) {
      // Restart streaming with new replica
      setIsStreaming(false)
      setTimeout(() => setIsStreaming(true), 100)
    }
  }, [selectedReplica])

  const getSelectedReplicaName = () => {
    if (!replicas) return containerName
    const replica = replicas.find((r) => r.name === selectedReplica)
    return replica?.name || containerName
  }

  // const getStatusColor = (status: string) => {
  //   switch (status) {
  //     case 'running':
  //       return 'text-green-600 bg-green-50'
  //     case 'stopped':
  //       return 'text-red-600 bg-red-50'
  //     case 'starting':
  //       return 'text-yellow-600 bg-yellow-50'
  //     default:
  //       return 'text-gray-600 bg-gray-50'
  //   }
  // }

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  const handleToggleStreaming = () => {
    setError(null)
    setIsStreaming(!isStreaming)
  }

  const handleClearLogs = () => {
    setLogs([])
    setError(null)
  }

  const handleDownloadLogs = () => {
    const logsText = logs.join('\n')
    const blob = new Blob([logsText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${containerName}-logs-${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleRefreshLogs = () => {
    setIsLoading(true)
    setError(null)
    setLogs([])
    
    // Restart streaming to get fresh logs
    if (isStreaming) {
      setIsStreaming(false)
      setTimeout(() => {
        setIsStreaming(true)
        setIsLoading(false)
      }, 100)
    } else {
      // If not streaming, do a one-time fetch
      setIsStreaming(true)
      setTimeout(() => {
        setIsStreaming(false)
        setIsLoading(false)
      }, 2000)
    }
  }

  const handleScroll = () => {
    if (!logsContainerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10
    setAutoScroll(isAtBottom)
  }

  return (
    <div className='space-y-4'>
      {/* Replica Selector */}
      {replicas && replicas.length > 0 && (
        <div className='p-4 bg-muted/10 rounded-lg border'>
          <div className='flex items-center gap-4 flex-wrap'>
            <span className='text-sm font-medium text-muted-foreground'>Select Replica:</span>
            <div className='flex items-center gap-2 flex-wrap'>
              {replicas.map((replica) => (
                <button
                  type='button'
                  key={replica.name}
                  onClick={() => setSelectedReplica(replica.name)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedReplica === replica.name
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      replica.status === 'running'
                        ? 'bg-green-500'
                        : replica.status === 'starting'
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                  >
                  </div>
                  <span>{replica.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className='flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/20 rounded-lg border'>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={handleToggleStreaming}
            disabled={isLoading}
            className='flex items-center gap-2'
          >
            {isStreaming
              ? (
                <>
                  <Pause className='h-4 w-4' />
                  Pause Stream
                </>
              )
              : (
                <>
                  <Play className='h-4 w-4' />
                  Resume Stream
                </>
              )}
          </Button>

          <Button
            variant='outline'
            size='sm'
            onClick={handleRefreshLogs}
            disabled={isLoading}
            className='flex items-center gap-2'
          >
            <RotateCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={handleDownloadLogs}
            className='flex items-center gap-2'
          >
            <Download className='h-4 w-4' />
            Download
          </Button>

          <Button
            variant='outline'
            size='sm'
            onClick={handleClearLogs}
            className='flex items-center gap-2 text-destructive hover:text-destructive'
          >
            <Trash2 className='h-4 w-4' />
            Clear
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className='p-3 bg-red-50 border border-red-200 rounded-lg'>
          <div className='flex items-center gap-2 text-red-800'>
            <span className='text-sm font-medium'>Error:</span>
            <span className='text-sm'>{error}</span>
          </div>
        </div>
      )}

      {/* Status */}
      <div className='flex items-center justify-between text-sm text-muted-foreground px-2'>
        <div className='flex items-center gap-4'>
          <span>
            Status: {isLoading
              ? <span className='text-blue-600 font-medium'>Loading...</span>
              : isStreaming
              ? <span className='text-green-600 font-medium'>Streaming</span>
              : <span className='text-yellow-600 font-medium'>Paused</span>}
          </span>
          <span>Lines: {logs.length}</span>
        </div>
        <div className='flex items-center gap-2'>
          <label className='flex items-center gap-2 cursor-pointer'>
            <input
              type='checkbox'
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className='rounded'
            />
            Auto-scroll
          </label>
        </div>
      </div>

      {/* Logs Container */}
      <div className='bg-card border rounded-lg overflow-hidden'>
        <div
          ref={logsContainerRef}
          onScroll={handleScroll}
          className='h-96 overflow-y-auto p-4 bg-black text-green-400 font-mono text-sm'
        >
          {logs.length === 0
            ? (
              <div className='text-muted-foreground text-center py-8'>
                No logs available
              </div>
            )
            : (
              <>
                {logs.map((log, index) => (
                  <div key={index} className='whitespace-pre-wrap break-words mb-1'>
                    {log}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </>
            )}
        </div>
      </div>

      {/* Footer Info */}
      <div className='text-xs text-muted-foreground px-2'>
        Container: {getSelectedReplicaName()} ({selectedReplica})
      </div>
    </div>
  )
}
