import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'

export const Meta = {
  aliases: {
    options: {
      output: 'o',
    },
  },
}

export const Input = z.object({
  output: z.enum(['wide', 'name', 'json', 'yaml', 'raw']).optional(),
  name: z.string().optional(), // Filter by specific volume name
  cluster: z.enum(['eu', 'eu-0', 'eu-1', 'eu-2']).optional(),
})

export type Input = z.infer<typeof Input>

export interface Volume {
  id: string
  name: string
  size: string
  mountPath: string
  status: 'mounted' | 'available' | 'error'
  created: string
  attachedTo: string[]  // Changed from string | null to string[] for multiple containers
  accessMode: string
  storageClass: string
}

type Output<Type extends 'raw' | 'json' | 'yaml' | 'name' | 'wide'> = {
  'raw': Volume[]
  'json': string
  'yaml': string
  'name': string
  'wide': void
}[Type]

export default async function* (
  { ctx, input }: ServerRequest<Input>,
): ServerResponse<Output<NonNullable<typeof input['output']>>> {
  const { output = 'raw', name, cluster = 'eu' } = input

  try {
    // Get all PersistentVolumeClaims from the specified cluster
    const client = ctx.kube.client[cluster as keyof typeof ctx.kube.client]
    const pvcList = await client.CoreV1.namespace(ctx.kube.namespace).getPersistentVolumeClaimList()

    // Filter by name if specified
    const filteredPVCs = name 
      ? pvcList.items.filter(pvc => pvc.metadata?.name === name)
      : pvcList.items

    // Transform PVCs to Volume format
    const volumes: Volume[] = filteredPVCs.map(pvc => {
      const metadata = pvc.metadata || {}
      const spec = pvc.spec || {}
      const status = pvc.status || {}
      
      // Determine attachment status by checking if volume is bound and has pods using it
      const volumeStatus = status.phase === 'Bound' ? 'mounted' : 
                          status.phase === 'Pending' ? 'available' : 'error'

      // Extract size from resources request
      const sizeRequest = String(spec.resources?.requests?.storage || '0Gi')
      
      // Get mount path from annotations if available
      const mountPath = metadata.annotations?.['ctnr.io/mount-path'] || '/mnt/volume'
      
      // Get attached containers from labels (support comma-separated list)
      const attachedToLabel = metadata.labels?.['ctnr.io/attached-to'] || ''
      const attachedTo = attachedToLabel ? attachedToLabel.split(',').map(s => s.trim()).filter(Boolean) : []

      return {
        id: metadata.uid || metadata.name || '',
        name: metadata.name || '',
        size: sizeRequest,
        mountPath,
        status: volumeStatus as 'mounted' | 'available' | 'error',
        created: String(metadata.creationTimestamp || new Date().toISOString()),
        attachedTo,
        accessMode: spec.accessModes?.[0] || 'ReadWriteOnce',
        storageClass: spec.storageClassName || 'default',
      }
    })

    switch (output) {
      case 'raw':
        return volumes

      case 'json':
        return JSON.stringify(volumes, null, 2)

      case 'yaml':
        // Simple YAML output for volumes
        return volumes.map(vol => 
          `name: ${vol.name}\n` +
          `size: ${vol.size}\n` +
          `status: ${vol.status}\n` +
          `mountPath: ${vol.mountPath}\n` +
          `attachedTo: ${vol.attachedTo || 'none'}\n---\n`
        ).join('')

      case 'name':
        return volumes.map(vol => vol.name).join('\n')

      case 'wide':
      default:
        // Header
        yield 'NAME'.padEnd(20) +
          'SIZE'.padEnd(10) +
          'STATUS'.padEnd(12) +
          'MOUNT PATH'.padEnd(25) +
          'ATTACHED TO'.padEnd(15) +
          'AGE'

        // Volume rows
        for (const volume of volumes) {
          const age = formatAge(volume.created)
          const attachedToStr = volume.attachedTo.length > 0 ? volume.attachedTo.join(', ') : 'none'
          yield volume.name.padEnd(20) +
            volume.size.padEnd(10) +
            volume.status.padEnd(12) +
            volume.mountPath.padEnd(25) +
            attachedToStr.padEnd(15) +
            age
        }
        return
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    yield `Error listing volumes: ${errorMessage}`
    throw error
  }
}

function formatAge(createdAt: string): string {
  const now = new Date()
  const created = new Date(createdAt)
  const diffMs = now.getTime() - created.getTime()
  
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  
  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  return `${minutes}m`
}