'use dom'

import { Button } from 'app/components/shadcn/ui/button.tsx'
import { Download, Pause, Play, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface ContainerInstance {
  id: string
  name: string
  status: string
  node: string
}

interface ContainerLogsProps {
  containerId: string
  containerName: string
  replicas?: ContainerInstance[]
}

export function ContainerLogs({ containerId, containerName, replicas }: ContainerLogsProps) {
  const [selectedReplica, setSelectedReplica] = useState<string>(replicas?.[0]?.id || containerId)
  const [logs, setLogs] = useState<string[]>([
    '[2024-01-15 10:30:15] Starting nginx: nginx.',
    '[2024-01-15 10:30:15] nginx: [warn] the "user" directive makes sense only if the master process runs with super-user privileges, ignored in /etc/nginx/nginx.conf:2',
    '[2024-01-15 10:30:15] 2024/01/15 10:30:15 [notice] 1#1: using the "epoll" event method',
    '[2024-01-15 10:30:15] 2024/01/15 10:30:15 [notice] 1#1: nginx/1.25.3',
    '[2024-01-15 10:30:15] 2024/01/15 10:30:15 [notice] 1#1: built by gcc 12.2.1 20220924 (Alpine 12.2.1_git20220924-r10)',
    '[2024-01-15 10:30:15] 2024/01/15 10:30:15 [notice] 1#1: OS: Linux 6.1.0-17-amd64',
    '[2024-01-15 10:30:15] 2024/01/15 10:30:15 [notice] 1#1: getrlimit(RLIMIT_NOFILE): 1048576:1048576',
    '[2024-01-15 10:30:15] 2024/01/15 10:30:15 [notice] 1#1: start worker processes',
    '[2024-01-15 10:30:15] 2024/01/15 10:30:15 [notice] 1#1: start worker process 29',
    '[2024-01-15 10:30:16] 172.17.0.1 - - [15/Jan/2024:10:30:16 +0000] "GET / HTTP/1.1" 200 615 "-" "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"',
    '[2024-01-15 10:30:17] 172.17.0.1 - - [15/Jan/2024:10:30:17 +0000] "GET /favicon.ico HTTP/1.1" 404 555 "http://localhost:3000/" "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"',
  ])
  const [isStreaming, setIsStreaming] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const logsContainerRef = useRef<HTMLDivElement>(null)

  // Reset logs when replica changes
  useEffect(() => {
    setLogs([
      `[${new Date().toISOString().slice(0, 19).replace('T', ' ')}] Switched to replica: ${selectedReplica}`,
      '[2024-01-15 10:30:15] Starting nginx: nginx.',
      '[2024-01-15 10:30:15] nginx: [warn] the "user" directive makes sense only if the master process runs with super-user privileges, ignored in /etc/nginx/nginx.conf:2',
      '[2024-01-15 10:30:15] 2024/01/15 10:30:15 [notice] 1#1: using the "epoll" event method',
    ])
  }, [selectedReplica])

  const getSelectedReplicaName = () => {
    if (!replicas) return containerName
    const replica = replicas.find((r) => r.id === selectedReplica)
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

  // Simulate streaming logs
  useEffect(() => {
    if (!isStreaming) return

    const interval = setInterval(() => {
      const newLogMessages = [
        `[${new Date().toISOString().slice(0, 19).replace('T', ' ')}] 172.17.0.1 - - [${
          new Date().toISOString().slice(0, 19).replace('T', ' ')
        } +0000] "GET /api/health HTTP/1.1" 200 2 "-" "curl/7.68.0"`,
        `[${new Date().toISOString().slice(0, 19).replace('T', ' ')}] Processing request from 172.17.0.1`,
        `[${new Date().toISOString().slice(0, 19).replace('T', ' ')}] Cache hit for key: user_session_abc123`,
        `[${new Date().toISOString().slice(0, 19).replace('T', ' ')}] Database query executed in 12ms`,
      ]

      const randomMessage = newLogMessages[Math.floor(Math.random() * newLogMessages.length)]
      setLogs((prev) => [...prev, randomMessage])
    }, 3000)

    return () => clearInterval(interval)
  }, [isStreaming])

  const handleToggleStreaming = () => {
    setIsStreaming(!isStreaming)
  }

  const handleClearLogs = () => {
    setLogs([])
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
    // In a real implementation, this would fetch fresh logs from the API
    console.log('Refreshing logs...')
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
                  key={replica.id}
                  onClick={() => setSelectedReplica(replica.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedReplica === replica.id ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
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
                  <span className='text-xs opacity-70'>({replica.node})</span>
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
            className='flex items-center gap-2'
          >
            <RotateCcw className='h-4 w-4' />
            Refresh
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

      {/* Status */}
      <div className='flex items-center justify-between text-sm text-muted-foreground px-2'>
        <div className='flex items-center gap-4'>
          <span>
            Status: {isStreaming
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
