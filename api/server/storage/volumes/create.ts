import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { createVolume, waitForVolumeReady } from 'lib/storage/volume.ts'

export const Meta = {
  aliases: {
    options: {},
  },
}

const clusterNames = ['eu-0', 'eu-1', 'eu-2'] as const

export const Input = z.object({
  name: z.string()
    .min(1, 'Volume name is required')
    .max(63, 'Volume name must be 63 characters or less')
    .regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, 'Volume name must be lowercase alphanumeric with hyphens'),
  size: z.string()
    .regex(/^\d+[KMGT]?i?$/, 'Size must be in format like 10Gi, 500Mi, 1Ti')
    .describe('Volume size (e.g., 10Gi, 500Mi, 1Ti)'),
  mountPath: z.string()
    .min(1, 'Mount path is required')
    .regex(/^\/.*/, 'Mount path must start with /')
    .describe('Path where the volume will be mounted'),
})

export type Input = z.infer<typeof Input>

export default async function* (
  { ctx, input }: ServerRequest<Input>,
): ServerResponse<void> {
  const { 
    name, 
    size, 
  } = input

  try {
    // Get the Kubernetes client for the specified cluster
    const kubeClient = ctx.kube.client['eu']

    // Create the volume using shared utility
    const result = yield* createVolume({
      name,
      size,
      userId: ctx.auth.user.id,
      namespace: ctx.kube.namespace,
      kubeClient: kubeClient,
      cluster: clusterNames[Math.floor(Math.random() * 10 % clusterNames.length)],
      createdBy: 'volume-create',
    })

    if (!result.created) {
      throw new Error(`Volume ${name} already exists`)
    }

    // Wait for the volume to be ready
    yield* waitForVolumeReady(name, ctx.kube.namespace, kubeClient, 30)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    yield `❌ Error creating volume: ${errorMessage}`
    throw error
  }
}