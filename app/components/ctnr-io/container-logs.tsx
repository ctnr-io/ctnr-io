'use dom'

import { Button } from 'app/components/shadcn/ui/button.tsx'
import { Input } from 'app/components/shadcn/ui/input.tsx'
import {
  ArrowDown,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eraser,
  Pause,
  Play,
  RotateCcw,
  Search,
  WrapText,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTRPC } from 'driver/trpc/client/expo/mod.tsx'
import { useSubscription } from '@trpc/tanstack-react-query'
// @ts-ignore (no types)
import Ansi from 'ansi-to-react'
import { SearchableSelect, SearchableSelectOption } from './searchable-select.tsx'
import { useSidebar } from '../shadcn/ui/sidebar.tsx'
import { cn } from 'lib/shadcn/utils.ts'

interface ContainerInstance {
  name: string
  status: string
}

interface ContainerLogsProps {
  containerName: string
  replicas?: ContainerInstance[]
}

interface LogsState {
  selectedReplicaName: string | null
  logs: string[]
  isStreaming: boolean
  autoScroll: boolean
  wrapLines: boolean
  error: string | null
  searchQuery: string
  searchResults: number[]
  currentSearchIndex: number
  showSearch: boolean
}

export function ContainerLogs({ containerName, replicas }: ContainerLogsProps) {
  const [state, setState] = useState<LogsState>({
    selectedReplicaName: null,
    logs: [],
    isStreaming: true,
    autoScroll: true,
    wrapLines: false,
    error: null,
    searchQuery: '',
    searchResults: [],
    currentSearchIndex: -1,
    showSearch: false,
  })

  const logsEndRef = useRef<HTMLDivElement>(null)
  const logsContainerRef = useRef<HTMLDivElement>(null)
  const desktopSearchInputRef = useRef<HTMLInputElement>(null)
  const mobileSearchInputRef = useRef<HTMLInputElement>(null)

  const trpc = useTRPC()

  const sidebar = useSidebar()

  // Logs subscription for streaming
  const { reset, status } = useSubscription(
    trpc.core.logs.subscriptionOptions({
      name: containerName,
      follow: true,
      replica: state.selectedReplicaName ? [state.selectedReplicaName] : undefined,
      timestamps: false,
      tail: 100, // Show last 100 lines initially
    }, {
      onData: (data) => {
        if (state.isStreaming && data.type === 'yield' && data.value) {
          setState((prev) => ({ ...prev, logs: [...prev.logs, data.value!], error: null }))
        } else if (data.type === 'return') {
          setState((prev) => ({ ...prev, isStreaming: false }))
        }
      },
      onError: (err: any) => {
        setState((prev) => ({
          ...prev,
          error: err.message || 'An error occurred while streaming logs',
          isStreaming: false,
        }))
      },
    }),
  )

  const isLoading = status === 'connecting'

  // Reset logs when replica changes
  useEffect(() => {
    setState((prev) => ({ ...prev, logs: [], error: null }))
    if (state.isStreaming) {
      // Restart streaming with new replica selection
      setState((prev) => ({ ...prev, isStreaming: false }))
      setTimeout(() => setState((prev) => ({ ...prev, isStreaming: true })), 100)
    }
  }, [state.selectedReplicaName])

  const getSelectedReplicaName = () => {
    if (!state.selectedReplicaName) return 'All Replicas'
    if (!replicas) return containerName
    const replica = replicas.find((r) => r.name === state.selectedReplicaName)
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
    if (state.autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [state.logs, state.autoScroll])

  const handleToggleStreaming = () => {
    setState((prev) => ({ ...prev, error: null, isStreaming: !prev.isStreaming }))
  }

  const handleClearLogs = () => {
    setState((prev) => ({ ...prev, logs: [], error: null }))
  }

  const handleDownloadLogs = () => {
    const logsText = state.logs.join('\n')
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
    setState((state) => ({ ...state, logs: [], error: null }))
    // Restart streaming to get fresh logs
    if (state.isStreaming) {
      reset()
    } else {
      reset()
    }
  }

  // Utility function to strip ANSI escape codes
  const stripAnsiCodes = (text: string): string => {
    return text.replace(/\x1b\[[0-9;]*m/g, '')
  }

  // Search functionality
  const performSearch = (query: string) => {
    if (!query.trim()) {
      setState((prev) => ({ ...prev, searchResults: [], currentSearchIndex: -1 }))
      return
    }

    const results: number[] = []
    const searchTerm = query.toLowerCase()

    state.logs.forEach((log, index) => {
      const cleanLog = stripAnsiCodes(log).toLowerCase()
      if (cleanLog.includes(searchTerm)) {
        results.push(index)
      }
    })

    setState((prev) => ({
      ...prev,
      searchResults: results,
      currentSearchIndex: results.length > 0 ? 0 : -1,
    }))

    // Scroll to first result
    if (results.length > 0) {
      scrollToSearchResult(0, results)
    }
  }

  const scrollToSearchResult = (resultIndex: number, results: number[]) => {
    if (resultIndex < 0 || resultIndex >= results.length) return

    const logIndex = results[resultIndex]
    const logElement = document.querySelector(`[data-log-index="${logIndex}"]`)
    if (logElement && logsContainerRef.current) {
      logElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const handleSearchChange = (query: string) => {
    setState((prev) => ({ ...prev, searchQuery: query }))
    performSearch(query)
  }

  const handleSearchNext = () => {
    if (state.searchResults.length === 0) return

    const nextIndex = (state.currentSearchIndex + 1) % state.searchResults.length
    setState((prev) => ({ ...prev, currentSearchIndex: nextIndex }))
    scrollToSearchResult(nextIndex, state.searchResults)
  }

  const handleSearchPrevious = () => {
    if (state.searchResults.length === 0) return

    const prevIndex = state.currentSearchIndex === 0 ? state.searchResults.length - 1 : state.currentSearchIndex - 1
    setState((prev) => ({ ...prev, currentSearchIndex: prevIndex }))
    scrollToSearchResult(prevIndex, state.searchResults)
  }

  const handleToggleSearch = () => {
    const wasShowingSearch = state.showSearch

    setState((prev) => ({
      ...prev,
      showSearch: !prev.showSearch,
      searchQuery: prev.showSearch ? '' : prev.searchQuery,
      searchResults: prev.showSearch ? [] : prev.searchResults,
      currentSearchIndex: prev.showSearch ? -1 : prev.currentSearchIndex,
    }))

    // Focus search input when opening
    if (!wasShowingSearch) {
      setTimeout(() => {
        // Check if we're on mobile or desktop and focus the appropriate input
        const isMobile = globalThis.innerWidth < 640 // sm breakpoint
        const inputRef = isMobile ? mobileSearchInputRef : desktopSearchInputRef

        if (inputRef.current) {
          inputRef.current.focus()
          if (state.searchQuery) {
            inputRef.current.select() // Select existing text if any
          }
        }
      }, 200) // Increased timeout to ensure DOM updates
    }
  }

  const transformLogForSearch = (text: string, query: string): string => {
    if (!query.trim()) return text

    const cleanText = stripAnsiCodes(text)
    const searchTerm = query.toLowerCase()
    const cleanTextLower = cleanText.toLowerCase()

    // If line doesn't contain search term, dim it with ANSI codes
    if (!cleanTextLower.includes(searchTerm)) {
      return '\x1b[2m' + text + '\x1b[0m' // Dim the entire line
    }

    // If line contains search term, highlight the matching words
    let result = text
    let searchIndex = cleanTextLower.indexOf(searchTerm)
    let offset = 0

    while (searchIndex !== -1) {
      // Find the actual position in the original text (accounting for ANSI codes)
      const match = cleanText.substring(searchIndex, searchIndex + searchTerm.length)

      // Insert highlighting around the match
      const highlightStart = '\x1b[43m\x1b[30m' // Yellow background, black text
      const highlightEnd = '\x1b[0m' // Reset

      // Replace in the result string
      const matchStart = result.indexOf(match, offset)
      if (matchStart !== -1) {
        result = result.substring(0, matchStart) +
          highlightStart + match + highlightEnd +
          result.substring(matchStart + match.length)
        offset = matchStart + highlightStart.length + match.length + highlightEnd.length
      }

      // Find next occurrence
      searchIndex = cleanTextLower.indexOf(searchTerm, searchIndex + searchTerm.length)
    }

    return result
  }

  // Re-run search when logs change
  useEffect(() => {
    if (state.searchQuery.trim()) {
      performSearch(state.searchQuery)
    }
  }, [state.logs])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'f') {
          e.preventDefault()
          if (!state.showSearch) {
            handleToggleSearch()
          }
        }
      }

      if (state.showSearch) {
        if (e.key === 'Escape') {
          handleToggleSearch()
        } else if (e.key === 'Enter') {
          if (e.shiftKey) {
            handleSearchPrevious()
          } else {
            handleSearchNext()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [state.showSearch, state.searchResults, state.currentSearchIndex])

  const handleCopyAllLogs = async () => {
    try {
      // Strip ANSI codes and join logs
      const cleanLogs = state.logs.map(stripAnsiCodes).join('\n')

      if (navigator.clipboard && globalThis.isSecureContext) {
        await navigator.clipboard.writeText(cleanLogs)
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = cleanLogs
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        textArea.remove()
      }

      // Could add a toast notification here if available
    } catch (err) {
      console.error('Failed to copy logs:', err)
      setState((prev) => ({ ...prev, error: 'Failed to copy logs to clipboard' }))
    }
  }

  const handleScroll = () => {
    if (!logsContainerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10
    setState((prev) => ({ ...prev, autoScroll: isAtBottom }))
  }

  // Create options for the SearchableSelect
  const replicaOptions: SearchableSelectOption[] = [
    {
      value: 'all',
      label: 'All Replicas',
      icon: <div className='w-2 h-2 rounded-full bg-blue-500' />,
    },
    ...(replicas?.map((replica) => ({
      value: replica.name,
      label: replica.name.split(containerName + '-')[1] || replica.name,
      icon: (
        <div
          className={`w-2 h-2 rounded-full ${
            replica.status === 'running'
              ? 'bg-green-500'
              : replica.status === 'starting'
              ? 'bg-yellow-500'
              : 'bg-red-500'
          }`}
        />
      ),
    })) || []),
  ]

  const handleReplicaChange = (value: string) => {
    setState((prev) => ({
      ...prev,
      selectedReplicaName: value === 'all' ? null : value,
    }))
  }

  return (
    <div className='sm:space-y-4 relative'>
      {/* Enhanced Controls Bar */}
      <div
        className={cn(
          'bg-card sm:rounded-lg border sticky',
          'top-14',
          sidebar.open ? 'md:top-14' : 'md:top-10',
          // add transition like sidebar,
          'transition-all duration-300',
        )}
      >
        {/* Main Controls Row */}
        <div className='flex flex-row gap-4 p-4 flex-wrap justify-between'>
          <div className='flex-1 flex items-center gap-4'>
            {/* Left Section - Replica Selection */}
            {replicas && replicas.length > 0 && (
              <SearchableSelect
                options={replicaOptions}
                value={state.selectedReplicaName || 'all'}
                onValueChange={handleReplicaChange}
                placeholder='Select replica...'
                searchPlaceholder='Search replicas...'
                emptyMessage='No replica found.'
                popoverClassName='w-[200px]'
                className='flex-1 min-w-fit md:text-foreground/100 hover:md:text-foreground/100 overflow-hidden'
              />
            )}

          <div className='flex items-center gap-2'>
            {/* Center Section - Stream Controls */}
            <Button
              variant={state.isStreaming ? 'default' : 'ghost'}
              size='sm'
              onClick={handleToggleStreaming}
              className='h-8 px-3'
              title={state.isStreaming ? 'Pause streaming' : 'Resume streaming'}
            >
              {state.isStreaming ? <Pause className='h-4 w-4' /> : <Play className='h-4 w-4' />}
              <span className='ml-1 hidden xl:inline'>
                {state.isStreaming ? 'Pause' : 'Resume'}
              </span>
            </Button>

            <Button
              variant='ghost'
              size='sm'
              onClick={handleRefreshLogs}
              className='h-8 px-3 bg-card'
              title='Refresh logs'
            >
              <RotateCcw className={`h-4 w-4 ${isLoading ? 'animate-[spin_reverse_1s_linear_infinite]' : ''}`} />
              <span className='ml-1 hidden 2xl:inline'>
                {isLoading ? 'Refreshing' : 'Refresh'}
              </span>
            </Button>
            </div>
          </div>
          <div className='flex-1 flex flex-row gap-4 justify-between'>
            <div className='flex items-center gap-2'>
              <Button
                variant={state.autoScroll ? 'default' : 'ghost'}
                size='sm'
                onClick={() => setState((prev) => ({ ...prev, autoScroll: !prev.autoScroll }))}
                className='h-8 px-3'
                title='Toggle auto-scroll'
              >
                <ArrowDown className='h-4 w-4' />
                <span className={cn('ml-1 hidden', sidebar.open ? 'xl:inline' : 'lg:inline')}>Auto-scroll</span>
              </Button>

              <Button
                variant={state.wrapLines ? 'default' : 'ghost'}
                size='sm'
                onClick={() => setState((prev) => ({ ...prev, wrapLines: !prev.wrapLines }))}
                className='h-8 px-3'
                title='Toggle line wrapping'
              >
                <WrapText className='h-4 w-4' />
               <span className={cn('ml-1 hidden', sidebar.open ? 'xl:inline' : 'lg:inline')}>Wrap</span>
              </Button>
            </div>

            {/* Right Section - Actions */}
            <div className='flex items-center gap-2'>
              <Button
                variant={state.showSearch ? 'default' : 'outline'}
                size='sm'
                onClick={handleToggleSearch}
                className='h-8 px-3'
                title='Search in logs (Ctrl+F)'
              >
                <Search className='h-4 w-4' />
                <span className={cn('ml-1 hidden', sidebar.open ? 'xl:inline' : 'lg:inline')}>Search</span>
              </Button>

              <div className='flex items-center gap-1'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleCopyAllLogs}
                  className='h-8 px-3'
                  title='Copy all logs'
                >
                  <Copy className='h-4 w-4' />
                  <span className={cn('ml-1 hidden', sidebar.open ? 'xl:inline' : 'lg:inline')}>Copy</span>
                </Button>

                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleDownloadLogs}
                  className='h-8 px-3'
                  title='Download logs'
                >
                  <Download className='h-4 w-4' />
                  <span className={cn('ml-1 hidden', sidebar.open ? 'xl:inline' : 'lg:inline')}>Download</span>
                </Button>

                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleClearLogs}
                  className='h-8 px-3'
                  title='Clear all logs'
                >
                  <Eraser className='h-4 w-4' />
                  <span className={cn('ml-1 hidden', sidebar.open ? 'xl:inline' : 'lg:inline')}>Clear</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar - Expanded when active (Desktop only) */}
        {state.showSearch && (
          <div className='border-t bg-muted/30 p-4 hidden sm:block'>
            <div className='flex items-center gap-3'>
              <div className='relative flex-1 max-w-md'>
                <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                <Input
                  ref={desktopSearchInputRef}
                  type='text'
                  placeholder='Search in logs... (Enter: next, Shift+Enter: previous, Esc: close)'
                  value={state.searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className='pl-10 pr-4 h-9'
                />
              </div>

              <div className='flex items-center gap-1'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleSearchPrevious}
                  disabled={state.searchResults.length === 0}
                  className='h-9 px-3'
                  title='Previous match (Shift+Enter)'
                >
                  <ChevronUp className='h-4 w-4' />
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleSearchNext}
                  disabled={state.searchResults.length === 0}
                  className='h-9 px-3'
                  title='Next match (Enter)'
                >
                  <ChevronDown className='h-4 w-4' />
                </Button>
              </div>

              {state.searchQuery && (
                <div className='text-sm text-muted-foreground font-medium min-w-fit'>
                  {state.searchResults.length > 0
                    ? `${state.currentSearchIndex + 1} of ${state.searchResults.length}`
                    : 'No matches'}
                </div>
              )}

              <Button
                variant='ghost'
                size='sm'
                onClick={handleToggleSearch}
                className='h-9 px-3'
                title='Close search (Esc)'
              >
                <X className='h-4 w-4' />
              </Button>
            </div>
          </div>
        )}

        {/* Status Bar */}
        <div className='hidden sm:block border-t bg-muted/20 px-4 py-2'>
          <div className='flex items-center justify-between text-xs text-muted-foreground'>
            <div className='flex items-center gap-4'>
              <div className='flex items-center gap-2'>
                <div
                  className={`w-2 h-2 rounded-full ${
                    isLoading ? 'bg-blue-500 animate-pulse' : state.isStreaming ? 'bg-green-500' : 'bg-yellow-500'
                  }`}
                />
                <span className='font-medium'>
                </span>
              </div>
              <span>Lines: {state.logs.length.toLocaleString()}</span>
              {state.searchQuery && <span>Matches: {state.searchResults.length}</span>}
            </div>
            <div className='hidden sm:block'>
              Container: <span className='font-medium'>{containerName}</span>
              {state.selectedReplicaName && (
                <>
                  | Replica: <span className='font-medium'>{state.selectedReplicaName}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {state.error && (
        <div className='p-3 bg-red-50 border border-red-200 sm:rounded-lg'>
          <div className='flex items-center gap-2 text-red-800'>
            <span className='text-sm font-medium'>Error:</span>
            <span className='text-sm'>{state.error}</span>
          </div>
        </div>
      )}

      {/* Logs Container */}
      <div className='bg-card border sm:rounded-lg overflow-hidden'>
        <div
          ref={logsContainerRef}
          onScroll={handleScroll}
          className={`min-h-96 overflow-y-auto p-4 bg-gray-900 text-gray-100 font-mono text-sm border-slate-700 ${
            state.wrapLines ? '' : 'overflow-x-auto'
          }`}
        >
          {state.logs.length === 0
            ? (
              <div className='text-slate-400 text-center py-8'>
                No logs available
              </div>
            )
            : (
              <>
                {state.logs.map((log: string, index: number) => {
                  const isCurrentSearchResult = state.searchResults[state.currentSearchIndex] === index
                  return (
                    <div
                      key={index}
                      data-log-index={index}
                      className={`mb-1 leading-relaxed ${
                        state.wrapLines ? 'whitespace-pre-wrap break-words overflow-wrap-anywhere' : 'whitespace-pre'
                      } ${isCurrentSearchResult ? 'bg-blue-900/30 border-l-4 border-blue-400 pl-2 -ml-2' : ''}`}
                    >
                      {/* @ts-ignore */}
                      <Ansi>{transformLogForSearch(log, state.searchQuery)}</Ansi>
                    </div>
                  )
                })}
                <div ref={logsEndRef} />
              </>
            )}
        </div>
      </div>

      {/* Footer Info */}
      <div className='hidden sm:block text-xs text-muted-foreground px-2'>
        Container: {containerName} | Viewing: {getSelectedReplicaName()}
      </div>

      {/* Mobile-Only Search Bar - Fixed at bottom */}
      {state.showSearch && (
        <div className='fixed bottom-0 left-0 right-0 bg-card border-t p-4 z-50 sm:hidden'>
          <div className='flex items-center gap-2'>
            <div className='relative flex-1'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                ref={mobileSearchInputRef}
                type='text'
                placeholder='Search in logs...'
                value={state.searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className='pl-10 pr-4 bg-card'
              />
            </div>
            <div className='flex items-center gap-1'>
              <Button
                variant='outline'
                size='sm'
                onClick={handleSearchPrevious}
                disabled={state.searchResults.length === 0}
                className='px-2'
                title='Previous match'
              >
                <ChevronUp className='h-4 w-4' />
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={handleSearchNext}
                disabled={state.searchResults.length === 0}
                className='px-2'
                title='Next match'
              >
                <ChevronDown className='h-4 w-4' />
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={handleToggleSearch}
                className='px-2'
                title='Close search'
              >
                <X className='h-4 w-4' />
              </Button>
            </div>
          </div>
          {state.searchQuery && (
            <div className='text-sm text-muted-foreground mt-2 text-center'>
              {state.searchResults.length > 0
                ? `${state.currentSearchIndex + 1} of ${state.searchResults.length} matches`
                : 'No matches found'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
