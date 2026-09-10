'use dom'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTRPC } from 'api/drivers/trpc/client/expo/mod.tsx'
import { AlertTriangle, CheckCircle2, Cpu, MemoryStick, XCircle } from 'lucide-react'
import type { ContainerInstance } from 'core/schemas/mod.ts'

const MAX_SAMPLES = 60
const POLL_INTERVAL_MS = 5000

interface MetricSample {
  timestamp: number
  cpuMillicores: number
  memoryMiB: number
}

interface ContainerMetricsProps {
  containerName: string
}

// Kubernetes CPU quantity ("15m", "0.5", "2") -> millicores
function parseCpuMillicores(value: string): number {
  if (!value) return 0
  if (value.endsWith('n')) return parseFloat(value) / 1e6
  if (value.endsWith('u')) return parseFloat(value) / 1e3
  if (value.endsWith('m')) return parseFloat(value)
  const cores = parseFloat(value)
  return Number.isFinite(cores) ? cores * 1000 : 0
}

// Kubernetes memory quantity ("128Mi", "1Gi", "512000") -> MiB
const MEMORY_UNIT_BYTES: Record<string, number> = {
  Ki: 2 ** 10,
  Mi: 2 ** 20,
  Gi: 2 ** 30,
  Ti: 2 ** 40,
  Pi: 2 ** 50,
  Ei: 2 ** 60,
  k: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
  P: 1e15,
  E: 1e18,
}
function parseMemoryMiB(value: string): number {
  if (!value) return 0
  const match = value.match(/^([0-9.eE+-]+)([a-zA-Z]*)$/)
  if (!match) return 0
  const num = parseFloat(match[1])
  const suffix = match[2]
  const bytes = suffix ? num * (MEMORY_UNIT_BYTES[suffix] ?? 1) : num
  return bytes / 2 ** 20
}

function formatMillicores(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} cores` : `${Math.round(m)}m`
}

function formatMiB(mib: number): string {
  return mib >= 1024 ? `${(mib / 1024).toFixed(2)} GiB` : `${mib.toFixed(0)} MiB`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStatusDotColor(status: string): string {
  switch (status) {
    case 'running':
      return 'bg-chart-2'
    case 'starting':
      return 'bg-chart-4'
    default:
      return 'bg-destructive'
  }
}

// Minimal inline sparkline, no charting dependency
function Sparkline({ samples, className }: { samples: number[]; className?: string }) {
  const width = 300
  const height = 48
  const max = Math.max(...samples, 1)
  const points = samples.length > 1
    ? samples.map((v, i) => {
      const x = (i / (samples.length - 1)) * width
      const y = height - (v / max) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
    : ''

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio='none'>
      {points && (
        <polyline
          points={points}
          fill='none'
          stroke='currentColor'
          strokeWidth={2}
          strokeLinejoin='round'
          strokeLinecap='round'
        />
      )}
    </svg>
  )
}

export function ContainerMetrics({ containerName }: ContainerMetricsProps) {
  const trpc = useTRPC()
  const [history, setHistory] = useState<MetricSample[]>([])

  const { data: containers, isLoading, error } = useQuery({
    ...trpc.core.listQuery.queryOptions({
      output: 'raw',
      name: containerName,
      fields: ['replicas', 'metrics'],
    }),
    refetchInterval: POLL_INTERVAL_MS,
  })

  const replicas = containers?.[0]?.replicas
  const instances: ContainerInstance[] = replicas?.instances ?? []

  useEffect(() => {
    if (instances.length === 0) return
    const cpuMillicores = instances.reduce((sum, i) => sum + parseCpuMillicores(i.cpu), 0)
    const memoryMiB = instances.reduce((sum, i) => sum + parseMemoryMiB(i.memory), 0)
    setHistory((prev) => {
      const next = [...prev, { timestamp: Date.now(), cpuMillicores, memoryMiB }]
      return next.length > MAX_SAMPLES ? next.slice(next.length - MAX_SAMPLES) : next
    })
    // Sample once per successful poll; keyed on the polled container list.
  }, [containers])

  if (isLoading && !containers) {
    return <div className='text-sm text-muted-foreground p-4'>Loading metrics...</div>
  }

  if (error) {
    return (
      <div className='p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800'>
        Failed to load metrics: {error.message}
      </div>
    )
  }

  const latest = history[history.length - 1]
  const cpuSamples = history.map((s) => s.cpuMillicores)
  const memorySamples = history.map((s) => s.memoryMiB)

  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        <div className='border rounded-lg p-4 bg-card'>
          <div className='flex items-center justify-between mb-2'>
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              <Cpu className='h-4 w-4' />
              CPU usage
            </div>
            <span className='font-mono text-sm'>{latest ? formatMillicores(latest.cpuMillicores) : '-'}</span>
          </div>
          <Sparkline samples={cpuSamples} className='w-full h-12 text-chart-2' />
        </div>
        <div className='border rounded-lg p-4 bg-card'>
          <div className='flex items-center justify-between mb-2'>
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              <MemoryStick className='h-4 w-4' />
              Memory usage
            </div>
            <span className='font-mono text-sm'>{latest ? formatMiB(latest.memoryMiB) : '-'}</span>
          </div>
          <Sparkline samples={memorySamples} className='w-full h-12 text-chart-4' />
        </div>
      </div>

      <div className='space-y-3'>
        {instances.map((instance) => (
          <div key={instance.name} className='border rounded-lg p-4 bg-card'>
            <div className='flex items-center justify-between mb-2'>
              <div className='flex items-center gap-2'>
                <div className={`w-2 h-2 rounded-full ${getStatusDotColor(instance.status)}`} />
                <span className='font-medium text-sm'>{instance.name}</span>
                {instance.ready === true && <CheckCircle2 className='h-3.5 w-3.5 text-chart-2' />}
                {instance.ready === false && <XCircle className='h-3.5 w-3.5 text-destructive' />}
              </div>
              {typeof instance.restarts === 'number' && instance.restarts > 0 && (
                <span className='text-xs px-2 py-0.5 rounded-full bg-chart-4/10 text-chart-4'>
                  {instance.restarts} restart{instance.restarts === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-3 text-sm'>
              <div>
                <div className='text-muted-foreground text-xs'>CPU</div>
                <div className='font-mono'>{instance.cpu}</div>
              </div>
              <div>
                <div className='text-muted-foreground text-xs'>Memory</div>
                <div className='font-mono'>{instance.memory}</div>
              </div>
              {instance.node && (
                <div>
                  <div className='text-muted-foreground text-xs'>Node</div>
                  <div className='font-mono truncate'>{instance.node}</div>
                </div>
              )}
            </div>
            {instance.lastTermination && (
              <div className='mt-3 flex items-start gap-2 text-xs text-muted-foreground border-t pt-2'>
                <AlertTriangle className='h-3.5 w-3.5 text-chart-4 shrink-0 mt-0.5' />
                <span>
                  Last failure: {instance.lastTermination.reason ?? 'Unknown'}
                  {typeof instance.lastTermination.exitCode === 'number' && (
                    ` (exit ${instance.lastTermination.exitCode})`
                  )}
                  {instance.lastTermination.finishedAt && ` at ${formatDate(instance.lastTermination.finishedAt)}`}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
