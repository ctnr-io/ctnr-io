'use dom'

import { useState } from 'react'
import { useRouter } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from 'api/drivers/trpc/client/expo/mod.tsx'
import { CATALOG, CatalogEntry } from 'app/constants/catalog.ts'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '../shadcn/ui/card.tsx'
import { Badge } from '../shadcn/ui/badge.tsx'
import { Button } from '../shadcn/ui/button.tsx'
import ContainerCreateWizard, { ContainerCreateInitialValues } from './container-create-wizard.tsx'

function toInitialValues(entry: CatalogEntry): ContainerCreateInitialValues {
  return {
    image: entry.image,
    name: entry.id,
    ports: entry.ports.map((p) => ({ port: p.port, name: p.name, protocol: 'tcp' as const })),
    env: entry.env,
    volumes: entry.volumes,
    restart: entry.restart,
  }
}

// All of a single-service entry's required fields (image is the only one the create
// mutation requires) are already known, so Deploy skips the wizard entirely.
function toQuickDeployInput(entry: CatalogEntry) {
  return {
    image: entry.image,
    name: entry.id,
    env: entry.env.map((e) => `${e.key}=${e.value}`),
    publish: entry.ports.length > 0 ? entry.ports.map((p) => `${p.name ? `${p.name}:` : ''}${p.port}`) : undefined,
    volume: entry.volumes.map((v) => `${v.name}:${v.path}:${v.size}`),
    detach: true,
    restart: entry.restart,
  }
}

export default function CatalogCardsScreen() {
  const [selected, setSelected] = useState<CatalogEntry | undefined>(undefined)
  const [deployingId, setDeployingId] = useState<string | undefined>(undefined)
  const [deployError, setDeployError] = useState<{ id: string; message: string } | undefined>(undefined)

  const router = useRouter()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const quickDeployMutation = useMutation(trpc.core.runMutation.mutationOptions())

  const quickDeploy = (entry: CatalogEntry) => {
    setDeployError(undefined)
    setDeployingId(entry.id)
    quickDeployMutation.mutate(toQuickDeployInput(entry), {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.core.listQuery.queryKey() })
        queryClient.refetchQueries({ queryKey: trpc.core.listQuery.queryKey() })
        queryClient.invalidateQueries({ queryKey: trpc.billing.getUsage.queryKey() })
        setDeployingId(undefined)
        setDeployError(undefined)
        router.push(`/containers/${entry.id}`)
      },
      onError: (error) => {
        setDeployingId(undefined)
        setDeployError({ id: entry.id, message: error.message })
      },
    })
  }

  return (
    <div className='space-y-4 p-4'>
      <div>
        <h1 className='text-2xl font-semibold'>Catalog</h1>
        <p className='text-muted-foreground text-sm'>
          Curated presets. Deploy a single-service preset in one click.
        </p>
      </div>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {CATALOG.map((entry) => (
          <Card key={entry.id}>
            <CardHeader>
              <CardTitle>{entry.name}</CardTitle>
              {entry.multiService && (
                <CardAction>
                  <Badge variant='secondary'>Multi-service</Badge>
                </CardAction>
              )}
              <CardDescription>{entry.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <code className='text-muted-foreground text-xs'>{entry.image}</code>
            </CardContent>
            <div className='px-6 flex gap-2'>
              <Button
                className='flex-1'
                disabled={entry.multiService || deployingId === entry.id}
                onClick={() => quickDeploy(entry)}
              >
                {entry.multiService ? 'Deploy (coming soon)' : deployingId === entry.id ? 'Deploying...' : 'Deploy'}
              </Button>
              {!entry.multiService && (
                <Button
                  variant='outline'
                  disabled={deployingId === entry.id}
                  onClick={() => setSelected(entry)}
                >
                  Customize
                </Button>
              )}
            </div>
            {deployError?.id === entry.id && <p className='px-6 pt-2 text-sm text-destructive'>{deployError.message}
            </p>}
          </Card>
        ))}
      </div>
      <ContainerCreateWizard
        open={selected !== undefined}
        onOpenChange={(open) => {
          if (!open) setSelected(undefined)
        }}
        initialValues={selected ? toInitialValues(selected) : undefined}
      />
    </div>
  )
}
