'use dom'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from 'api/drivers/trpc/client/expo/mod.tsx'
import { Plus, Trash2 } from 'lucide-react'
import ResponsiveDialog from './responsive-dialog.tsx'
import { Button } from '../shadcn/ui/button.tsx'
import { Input } from '../shadcn/ui/input.tsx'
import { Label } from '../shadcn/ui/label.tsx'
import { Progress } from '../shadcn/ui/progress.tsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../shadcn/ui/select.tsx'
import { Switch } from '../shadcn/ui/switch.tsx'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../shadcn/ui/collapsible.tsx'

type PortRow = { port: string; name: string; protocol: 'tcp' | 'udp' }
type EnvRow = { key: string; value: string }
type VolumeRow = { name: string; path: string; size: string }

const RESOURCE_PRESETS = [
  { id: 'small', label: 'Small', cpu: '250m', memory: '256M', description: '0.25 vCPU, 256 MB RAM' },
  { id: 'medium', label: 'Medium', cpu: '500m', memory: '512M', description: '0.5 vCPU, 512 MB RAM' },
  { id: 'large', label: 'Large', cpu: '1000m', memory: '1G', description: '1 vCPU, 1 GB RAM' },
] as const

const STEPS = ['Image', 'Resources', 'Networking', 'Review'] as const

export type ContainerCreateInitialValues = {
  image?: string
  name?: string
  ports?: PortRow[]
  env?: EnvRow[]
  volumes?: VolumeRow[]
  command?: string
  restart?: 'always' | 'on-failure' | 'never'
}

export default function ContainerCreateWizard({
  open,
  onOpenChange,
  onSuccess,
  onSwitchToCli,
  initialValues,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  onSwitchToCli?: () => void
  initialValues?: ContainerCreateInitialValues
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const [step, setStep] = useState(0)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // Step 1: image / source
  const [image, setImage] = useState('')
  const [name, setName] = useState('')

  // Step 2: resources
  const [presetId, setPresetId] = useState<typeof RESOURCE_PRESETS[number]['id']>('small')
  const [replicas, setReplicas] = useState('1')

  // Step 3: networking / domain
  const [ports, setPorts] = useState<PortRow[]>([])
  const [domain, setDomain] = useState('')
  const [routePort, setRoutePort] = useState('')

  // Advanced escape hatch (raw K8s-adjacent fields)
  const [envRows, setEnvRows] = useState<EnvRow[]>([])
  const [volumeRows, setVolumeRows] = useState<VolumeRow[]>([])
  const [command, setCommand] = useState('')
  const [restart, setRestart] = useState<'always' | 'on-failure' | 'never'>('never')
  const [force, setForce] = useState(false)
  const [interactive, setInteractive] = useState(false)
  const [terminal, setTerminal] = useState(false)
  const [customCpu, setCustomCpu] = useState('')
  const [customMemory, setCustomMemory] = useState('')

  // Prefill from a catalog entry when the dialog opens.
  useEffect(() => {
    if (!open) return
    setImage(initialValues?.image ?? '')
    setName(initialValues?.name ?? '')
    setPorts(initialValues?.ports ?? [])
    setEnvRows(initialValues?.env ?? [])
    setVolumeRows(initialValues?.volumes ?? [])
    setCommand(initialValues?.command ?? '')
    setRestart(initialValues?.restart ?? 'never')
  }, [open])

  const preset = RESOURCE_PRESETS.find((p) => p.id === presetId) ?? RESOURCE_PRESETS[0]
  const cpu = customCpu.trim() || preset.cpu
  const memory = customMemory.trim() || preset.memory

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.core.listQuery.queryKey() })
    queryClient.refetchQueries({ queryKey: trpc.core.listQuery.queryKey() })
    queryClient.invalidateQueries({ queryKey: trpc.billing.getUsage.queryKey() })
  }

  const runMutation = useMutation(
    trpc.core.runMutation.mutationOptions({
      onSuccess: () => {
        invalidate()
        onSuccess?.()
        reset()
        onOpenChange(false)
      },
    }),
  )

  const reset = () => {
    setStep(0)
    setAdvancedOpen(false)
    setImage('')
    setName('')
    setPresetId('small')
    setReplicas('1')
    setPorts([])
    setDomain('')
    setRoutePort('')
    setEnvRows([])
    setVolumeRows([])
    setCommand('')
    setRestart('never')
    setForce(false)
    setInteractive(false)
    setTerminal(false)
    setCustomCpu('')
    setCustomMemory('')
  }

  const canGoNext = useMemo(() => {
    if (step === 0) return image.trim().length > 0
    return true
  }, [step, image])

  const publish = useMemo(
    () =>
      ports
        .filter((p) => p.port.trim().length > 0)
        .map((p) => `${p.name.trim() ? `${p.name.trim()}:` : ''}${p.port.trim()}${p.protocol === 'udp' ? '/udp' : ''}`),
    [ports],
  )

  const defaultRoute = ports.find((p) => p.port.trim().length > 0)
  const effectiveRoute = routePort.trim() || defaultRoute?.name.trim() || defaultRoute?.port.trim() || ''

  const handleSubmit = () => {
    runMutation.mutate({
      image: image.trim(),
      name: name.trim() || undefined,
      env: envRows.filter((e) => e.key.trim()).map((e) => `${e.key.trim()}=${e.value}`),
      publish: publish.length > 0 ? publish : undefined,
      volume: volumeRows.filter((v) => v.name.trim() && v.path.trim()).map((v) =>
        `${v.name.trim()}:${v.path.trim()}:${v.size.trim() || '1G'}`
      ),
      domain: domain.trim() || undefined,
      interactive,
      terminal,
      detach: true,
      route: domain.trim() && effectiveRoute ? effectiveRoute : undefined,
      force,
      command: command.trim() || undefined,
      replicas: Number(replicas) || 1,
      cpu,
      memory,
      restart,
    })
  }

  const addPortRow = () => setPorts([...ports, { port: '', name: '', protocol: 'tcp' }])
  const removePortRow = (index: number) => setPorts(ports.filter((_, i) => i !== index))
  const updatePortRow = (index: number, patch: Partial<PortRow>) =>
    setPorts(ports.map((p, i) => (i === index ? { ...p, ...patch } : p)))

  const addEnvRow = () => setEnvRows([...envRows, { key: '', value: '' }])
  const removeEnvRow = (index: number) => setEnvRows(envRows.filter((_, i) => i !== index))
  const updateEnvRow = (index: number, patch: Partial<EnvRow>) =>
    setEnvRows(envRows.map((e, i) => (i === index ? { ...e, ...patch } : e)))

  const addVolumeRow = () => setVolumeRows([...volumeRows, { name: '', path: '', size: '1G' }])
  const removeVolumeRow = (index: number) => setVolumeRows(volumeRows.filter((_, i) => i !== index))
  const updateVolumeRow = (index: number, patch: Partial<VolumeRow>) =>
    setVolumeRows(volumeRows.map((v, i) => (i === index ? { ...v, ...patch } : v)))

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
      title='Run a new container'
      description={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
      showCloseButton
      contentClassName='!max-w-lg'
      footer={
        <div className='flex w-full items-center justify-between gap-2'>
          <Button
            variant='outline'
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0 || runMutation.isPending}
          >
            Back
          </Button>
          {step < STEPS.length - 1
            ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canGoNext}>
                Next
              </Button>
            )
            : (
              <Button onClick={handleSubmit} disabled={runMutation.isPending}>
                {runMutation.isPending ? 'Starting...' : 'Run container'}
              </Button>
            )}
        </div>
      }
    >
      <div className='space-y-4'>
        <Progress value={((step + 1) / STEPS.length) * 100} />

        {step === 0 && (
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='wizard-image'>Image</Label>
              <Input
                id='wizard-image'
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder='e.g., nginx:latest'
                autoFocus
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='wizard-name'>
                Name <i className='text-xs text-muted-foreground font-normal'>optional</i>
              </Label>
              <Input
                id='wizard-name'
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='auto-generated if left blank'
              />
            </div>
            {onSwitchToCli && (
              <button
                type='button'
                onClick={onSwitchToCli}
                className='text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground'
              >
                Prefer the CLI instead?
              </button>
            )}
          </div>
        )}

        {step === 1 && (
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label>Size</Label>
              <div className='grid grid-cols-3 gap-2'>
                {RESOURCE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type='button'
                    onClick={() => setPresetId(p.id)}
                    className={`rounded-md border p-3 text-left text-sm transition-colors ${
                      presetId === p.id ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div className='font-medium'>{p.label}</div>
                    <div className='text-xs text-muted-foreground'>{p.description}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='wizard-replicas'>Instances</Label>
              <Input
                id='wizard-replicas'
                type='number'
                min='1'
                max='20'
                value={replicas}
                onChange={(e) => setReplicas(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className='space-y-4'>
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <Label>Published ports</Label>
                <Button type='button' variant='outline' size='sm' onClick={addPortRow}>
                  <Plus className='h-3 w-3' />
                  Add port
                </Button>
              </div>
              {ports.length === 0 && (
                <p className='text-sm text-muted-foreground'>No ports published. Add one to expose the container.</p>
              )}
              {ports.map((p, i) => (
                <div key={i} className='grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center'>
                  <Input
                    placeholder='port, e.g. 80'
                    type='number'
                    value={p.port}
                    onChange={(e) => updatePortRow(i, { port: e.target.value })}
                  />
                  <Input
                    placeholder='name (optional)'
                    value={p.name}
                    onChange={(e) => updatePortRow(i, { name: e.target.value })}
                  />
                  <Select value={p.protocol} onValueChange={(v) => updatePortRow(i, { protocol: v as 'tcp' | 'udp' })}>
                    <SelectTrigger className='w-20'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='tcp'>tcp</SelectItem>
                      <SelectItem value='udp'>udp</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type='button' variant='ghost' size='icon' onClick={() => removePortRow(i)}>
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>
              ))}
            </div>
            {ports.length > 0 && (
              <div className='space-y-2'>
                <Label htmlFor='wizard-domain'>
                  Domain <i className='text-xs text-muted-foreground font-normal'>optional</i>
                </Label>
                <Input
                  id='wizard-domain'
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder='e.g., app.example.com'
                />
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className='space-y-4'>
            <div className='text-sm space-y-1 bg-muted/50 p-3 rounded-md'>
              <div>
                <strong>Image:</strong> {image || '-'}
              </div>
              <div>
                <strong>Name:</strong> {name || 'auto-generated'}
              </div>
              <div>
                <strong>Resources:</strong> {cpu} CPU, {memory} memory, {replicas} replica(s)
              </div>
              <div>
                <strong>Ports:</strong> {publish.length > 0 ? publish.join(', ') : 'none'}
              </div>
              <div>
                <strong>Domain:</strong> {domain || 'none'}
              </div>
            </div>

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button type='button' variant='outline' size='sm'>
                  {advancedOpen ? 'Hide' : 'Show'} advanced options
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className='space-y-4 pt-4'>
                <div className='grid grid-cols-2 gap-2'>
                  <div className='space-y-2'>
                    <Label htmlFor='wizard-cpu'>
                      CPU <i className='text-xs text-muted-foreground font-normal'>overrides preset</i>
                    </Label>
                    <Input
                      id='wizard-cpu'
                      value={customCpu}
                      onChange={(e) => setCustomCpu(e.target.value)}
                      placeholder={preset.cpu}
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='wizard-memory'>
                      Memory <i className='text-xs text-muted-foreground font-normal'>overrides preset</i>
                    </Label>
                    <Input
                      id='wizard-memory'
                      value={customMemory}
                      onChange={(e) => setCustomMemory(e.target.value)}
                      placeholder={preset.memory}
                    />
                  </div>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='wizard-command'>
                    Command <i className='text-xs text-muted-foreground font-normal'>optional</i>
                  </Label>
                  <Input
                    id='wizard-command'
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder='e.g., npm start'
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='wizard-restart'>Restart policy</Label>
                  <Select value={restart} onValueChange={(v) => setRestart(v as typeof restart)}>
                    <SelectTrigger id='wizard-restart'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='never'>never</SelectItem>
                      <SelectItem value='on-failure'>on-failure</SelectItem>
                      <SelectItem value='always'>always</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <Label>Environment variables</Label>
                    <Button type='button' variant='outline' size='sm' onClick={addEnvRow}>
                      <Plus className='h-3 w-3' />
                      Add
                    </Button>
                  </div>
                  {envRows.map((e, i) => (
                    <div key={i} className='grid grid-cols-[1fr_1fr_auto] gap-2'>
                      <Input
                        placeholder='KEY'
                        value={e.key}
                        onChange={(ev) => updateEnvRow(i, { key: ev.target.value.toUpperCase() })}
                      />
                      <Input
                        placeholder='value'
                        value={e.value}
                        onChange={(ev) => updateEnvRow(i, { value: ev.target.value })}
                      />
                      <Button type='button' variant='ghost' size='icon' onClick={() => removeEnvRow(i)}>
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <Label>Volume mounts</Label>
                    <Button type='button' variant='outline' size='sm' onClick={addVolumeRow}>
                      <Plus className='h-3 w-3' />
                      Add
                    </Button>
                  </div>
                  {volumeRows.map((v, i) => (
                    <div key={i} className='grid grid-cols-[1fr_1fr_1fr_auto] gap-2'>
                      <Input
                        placeholder='volume name'
                        value={v.name}
                        onChange={(ev) => updateVolumeRow(i, { name: ev.target.value })}
                      />
                      <Input
                        placeholder='mount path'
                        value={v.path}
                        onChange={(ev) => updateVolumeRow(i, { path: ev.target.value })}
                      />
                      <Input
                        placeholder='size, e.g. 1G'
                        value={v.size}
                        onChange={(ev) => updateVolumeRow(i, { size: ev.target.value })}
                      />
                      <Button type='button' variant='ghost' size='icon' onClick={() => removeVolumeRow(i)}>
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  ))}
                </div>

                {ports.length > 0 && (
                  <div className='space-y-2'>
                    <Label htmlFor='wizard-route'>
                      Route port{' '}
                      <i className='text-xs text-muted-foreground font-normal'>
                        which published port the domain routes to
                      </i>
                    </Label>
                    <Input
                      id='wizard-route'
                      value={routePort}
                      onChange={(e) => setRoutePort(e.target.value)}
                      placeholder={effectiveRoute || 'port name or number'}
                    />
                  </div>
                )}

                <div className='flex items-center justify-between'>
                  <Label htmlFor='wizard-force'>Force recreate if exists</Label>
                  <Switch id='wizard-force' checked={force} onCheckedChange={setForce} />
                </div>
                <div className='flex items-center justify-between'>
                  <Label htmlFor='wizard-interactive'>Interactive</Label>
                  <Switch id='wizard-interactive' checked={interactive} onCheckedChange={setInteractive} />
                </div>
                <div className='flex items-center justify-between'>
                  <Label htmlFor='wizard-terminal'>Terminal</Label>
                  <Switch id='wizard-terminal' checked={terminal} onCheckedChange={setTerminal} />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {runMutation.isError && <p className='text-sm text-destructive'>{runMutation.error.message}</p>}
          </div>
        )}
      </div>
    </ResponsiveDialog>
  )
}
