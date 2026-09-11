'use dom'

import { useState } from 'react'
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

export default function CatalogCardsScreen() {
  const [selected, setSelected] = useState<CatalogEntry | undefined>(undefined)

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
            <div className='px-6'>
              <Button
                className='w-full'
                disabled={entry.multiService}
                onClick={() => setSelected(entry)}
              >
                {entry.multiService ? 'Deploy (coming soon)' : 'Deploy'}
              </Button>
            </div>
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
