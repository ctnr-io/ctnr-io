import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'

export const Meta = {
  aliases: {
    options: {},
  },
}

export const Input = z.object({
  name: z.string()
    .min(1, 'Volume name is required')
    .describe('Name of the volume to delete'),
  cluster: z.enum(['eu', 'eu-0', 'eu-1', 'eu-2'])
    .optional()
    .default('eu')
    .describe('Cluster where the volume exists'),
  force: z.boolean()
    .optional()
    .default(false)
    .describe('Force delete even if volume is attached'),
})

export type Input = z.infer<typeof Input>

export default async function* (
  { ctx, input }: ServerRequest<Input>,
): ServerResponse<void> {
  const { name, cluster = 'eu', force = false } = input

  try {
    yield `Deleting volume ${name}...`

    // Get the Kubernetes client for the specified cluster
    const client = ctx.kube.client[cluster as keyof typeof ctx.kube.client]

    // Check if volume exists and get its current status
    let pvc
    try {
      pvc = await client.CoreV1.namespace(ctx.kube.namespace).getPersistentVolumeClaim(name)
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new Error(`Volume ${name} not found`)
      }
      throw error
    }

    // Check if volume is attached to any containers (unless force is true)
    if (!force && pvc.metadata?.labels?.['ctnr.io/attached-to']) {
      const attachedTo = pvc.metadata.labels['ctnr.io/attached-to']
      throw new Error(
        `Volume ${name} is currently attached to container "${attachedTo}". ` +
        `Detach the volume first or use --force to delete anyway.`
      )
    }

    // Check if volume is in use by any pods
    if (!force) {
      const podList = await client.CoreV1.namespace(ctx.kube.namespace).getPodList()
      const podsUsingVolume = podList.items.filter(pod => {
        const volumes = pod.spec?.volumes || []
        return volumes.some(volume => 
          volume.persistentVolumeClaim?.claimName === name
        )
      })

      if (podsUsingVolume.length > 0) {
        const podNames = podsUsingVolume.map(pod => pod.metadata?.name).join(', ')
        throw new Error(
          `Volume ${name} is currently in use by pods: ${podNames}. ` +
          `Stop the containers first or use --force to delete anyway.`
        )
      }
    }

    // Perform the deletion
    yield `Removing volume ${name} from cluster ${cluster}...`
    
    await client.CoreV1.namespace(ctx.kube.namespace).deletePersistentVolumeClaim(name)

    yield `Volume ${name} deletion initiated`

    // Wait for the volume to be fully deleted (with timeout)
    yield `Waiting for volume to be fully removed...`
    
    let attempts = 0
    const maxAttempts = 30 // 30 seconds timeout
    
    while (attempts < maxAttempts) {
      try {
        await client.CoreV1.namespace(ctx.kube.namespace).getPersistentVolumeClaim(name)
        // If we get here, the volume still exists
        attempts++
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          // Volume has been deleted
          yield `Volume ${name} has been successfully deleted`
          return
        }
        // Other error, re-throw
        throw error
      }
    }
    
    yield `Volume ${name} deletion is in progress. It may take a few more moments to complete.`

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    yield `Error deleting volume: ${errorMessage}`
    throw error
  }
}