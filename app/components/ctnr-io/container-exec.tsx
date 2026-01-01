'use dom'

import { Button } from 'app/components/shadcn/ui/button.tsx'
import { Input } from 'app/components/shadcn/ui/input.tsx'
import { Copy, Send, Terminal, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface ContainerInstance {
  name: string
  status: string
}

interface ContainerExecProps {
  containerName: string
  replicas?: ContainerInstance[]
}

interface TerminalLine {
  id: string
  type: 'command' | 'output' | 'error'
  content: string
  timestamp: Date
}

export function ContainerExec({ containerName, replicas }: ContainerExecProps) {
  const [selectedReplica, setSelectedReplica] = useState<string>(replicas?.[0]?.name!)
  const [command, setCommand] = useState('')
  const [history, setHistory] = useState<TerminalLine[]>([
    {
      id: '1',
      type: 'output',
      content: `Connected to container: ${containerName}`,
      timestamp: new Date(),
    },
    {
      id: '2',
      type: 'output',
      content: 'Type commands to execute in the container. Use "exit" to disconnect.',
      timestamp: new Date(),
    },
  ])
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isConnected, setIsConnected] = useState(true)
  const [isExecuting, setIsExecuting] = useState(false)
  const terminalEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset terminal when replica changes
  useEffect(() => {
    const replicaName = getSelectedReplicaName()
    setHistory([
      {
        id: Date.now().toString(),
        type: 'output',
        content: `Switched to replica: ${replicaName}`,
        timestamp: new Date(),
      },
      {
        id: (Date.now() + 1).toString(),
        type: 'output',
        content: 'Type commands to execute in the container. Use "exit" to disconnect.',
        timestamp: new Date(),
      },
    ])
    setCommandHistory([])
    setIsConnected(true)
  }, [selectedReplica])

  const getSelectedReplicaName = () => {
    if (!replicas) return containerName
    const replica = replicas.find((r) => r.name === selectedReplica)
    return replica?.name || containerName
  }

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [history])

  // Focus input when component mounts
  useEffect(() => {
    if (inputRef.current && isConnected) {
      inputRef.current.focus()
    }
  }, [isConnected])

  const executeCommand = async (cmd: string) => {
    if (!cmd.trim() || isExecuting) return

    setIsExecuting(true)

    // Add command to history
    const commandLine: TerminalLine = {
      id: Date.now().toString(),
      type: 'command',
      content: `$ ${cmd}`,
      timestamp: new Date(),
    }

    setHistory((prev) => [...prev, commandLine])
    setCommandHistory((prev) => [...prev, cmd])
    setHistoryIndex(-1)
    setCommand('')

    // Handle special commands
    if (cmd.toLowerCase() === 'exit') {
      const exitLine: TerminalLine = {
        id: (Date.now() + 1).toString(),
        type: 'output',
        content: 'Connection closed.',
        timestamp: new Date(),
      }
      setHistory((prev) => [...prev, exitLine])
      setIsConnected(false)
      setIsExecuting(false)
      return
    }

    if (cmd.toLowerCase() === 'clear') {
      setHistory([])
      setIsExecuting(false)
      return
    }

    // Simulate command execution
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000))

    // Mock responses for common commands
    let output = ''
    let isError = false

    switch (cmd.toLowerCase().split(' ')[0]) {
      case 'ls':
        output = 'bin  boot  dev  etc  home  lib  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var'
        break
      case 'pwd':
        output = '/usr/share/nginx/html'
        break
      case 'whoami':
        output = 'root'
        break
      case 'ps':
        output = `  PID TTY          TIME CMD
    1 ?        00:00:00 nginx
   29 ?        00:00:00 nginx
   30 pts/0    00:00:00 bash`
        break
      case 'cat':
        if (cmd.includes('/etc/nginx/nginx.conf')) {
          output = `user  nginx;
worker_processes  auto;

error_log  /var/log/nginx/error.log notice;
pid        /var/run/nginx.pid;

events {
    worker_connections  1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    sendfile        on;
    keepalive_timeout  65;
    
    include /etc/nginx/conf.d/*.conf;
}`
        } else {
          output = `cat: ${cmd.split(' ').slice(1).join(' ')}: No such file or directory`
          isError = true
        }
        break
      case 'echo':
        output = cmd.substring(5) // Remove 'echo '
        break
      case 'date':
        output = new Date().toString()
        break
      case 'uname':
        output = 'Linux'
        break
      default:
        if (cmd.trim()) {
          output = `bash: ${cmd.split(' ')[0]}: command not found`
          isError = true
        }
    }

    const outputLine: TerminalLine = {
      id: (Date.now() + 2).toString(),
      type: isError ? 'error' : 'output',
      content: output,
      timestamp: new Date(),
    }

    setHistory((prev) => [...prev, outputLine])
    setIsExecuting(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    executeCommand(command)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1)
        setHistoryIndex(newIndex)
        setCommand(commandHistory[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1)
          setCommand('')
        } else {
          setHistoryIndex(newIndex)
          setCommand(commandHistory[newIndex])
        }
      }
    }
  }

  const handleClearTerminal = () => {
    setHistory([])
  }

  const handleReconnect = () => {
    setIsConnected(true)
    setHistory([
      {
        id: Date.now().toString(),
        type: 'output',
        content: `Reconnected to container: ${containerName}`,
        timestamp: new Date(),
      },
    ])
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
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
                      : 'bg-muted hover:bg-muted/30'
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
          <Terminal className='h-4 w-4' />
          <span className='text-sm font-medium'>
            Status: {isConnected
              ? <span className='text-green-600'>Connected</span>
              : <span className='text-red-600'>Disconnected</span>}
          </span>
        </div>

        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={handleClearTerminal}
            className='flex items-center gap-2'
          >
            <Trash2 className='h-4 w-4' />
            Clear
          </Button>

          {!isConnected && (
            <Button
              variant='outline'
              size='sm'
              onClick={handleReconnect}
              className='flex items-center gap-2'
            >
              <Terminal className='h-4 w-4' />
              Reconnect
            </Button>
          )}
        </div>
      </div>

      {/* Terminal */}
      <div className='bg-card border rounded-lg overflow-hidden'>
        <div className='h-96 overflow-y-auto p-4 bg-black text-green-400 font-mono text-sm'>
          {history.map((line) => (
            <div key={line.id} className='mb-1 group flex items-start gap-2'>
              <div className='flex-1 whitespace-pre-wrap break-words'>
                <span
                  className={`${
                    line.type === 'command'
                      ? 'text-blue-400 font-bold'
                      : line.type === 'error'
                      ? 'text-red-400'
                      : 'text-green-400'
                  }`}
                >
                  {line.content}
                </span>
              </div>
              <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                <span className='text-xs text-gray-500'>
                  {formatTimestamp(line.timestamp)}
                </span>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => copyToClipboard(line.content)}
                  className='h-6 w-6 p-0 hover:bg-gray-800'
                  title='Copy line'
                >
                  <Copy className='h-3 w-3' />
                </Button>
              </div>
            </div>
          ))}

          {isExecuting && (
            <div className='text-yellow-400 animate-pulse'>
              Executing...
            </div>
          )}

          <div ref={terminalEndRef} />
        </div>

        {/* Command Input */}
        {isConnected && (
          <div className='border-t bg-black p-4'>
            <form onSubmit={handleSubmit} className='flex items-center gap-2'>
              <span className='text-green-400 font-mono text-sm'>$</span>
              <Input
                ref={inputRef}
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='Enter command...'
                disabled={isExecuting}
                className='flex-1 bg-transparent border-none text-green-400 font-mono text-sm placeholder:text-gray-600 focus:ring-0 focus:border-none'
              />
              <Button
                type='submit'
                variant='ghost'
                size='sm'
                disabled={isExecuting || !command.trim()}
                className='text-green-400 hover:bg-gray-800'
              >
                <Send className='h-4 w-4' />
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className='text-xs text-muted-foreground px-2'>
        Container: {getSelectedReplicaName()} ({selectedReplica})
        {commandHistory.length > 0 && (
          <span className='ml-4'>
            Commands executed: {commandHistory.length}
          </span>
        )}
      </div>
    </div>
  )
}
