import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { createVolume, waitForVolumeReady } from 'lib/storage/volume.ts'
import { ClusterName, ClusterNames } from 'lib/api/schemas.ts'

export const Meta = {
  aliases: {
    options: {},
  },
}

export const Input = z.object({
  name: z.string()
    .min(1, 'Volume name is required')
    .max(63, 'Volume name must be 63 characters or less')
    .regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, 'Volume name must be lowercase alphanumeric with hyphens'),
  size: z.string()
    .regex(/^\d+[KMGT]?i?$/, 'Size must be in format like 10Gi, 500Mi, 1Ti')
    .describe('Volume size (e.g., 10Gi, 500Mi, 1Ti)'),
  cluster: ClusterName.optional().describe('Cluster to create the volume in'),
  mountPath: z.string().describe('Path to mount the volume'),
})

export type Input = z.infer<typeof Input>

export default async function* (
  { ctx, input }: ServerRequest<Input>,
): ServerResponse<void> {
  const {
    name,
    size,
    mountPath,
  } = input

  try {
    // Get the Kubernetes client for the specified cluster
    const kubeClient = ctx.kube.client['karmada']

    // Create the volume using shared utility
    const result = yield* createVolume({
      name,
      size,
      userId: ctx.auth.user.id,
      namespace: ctx.project.namespace,
      kubeClient: kubeClient,
      mountPath,
    })

    if (!result.created) {
      throw new Error(`Volume ${name} already exists`)
    }

    // Wait for the volume to be ready
    yield* waitForVolumeReady(name, ctx.project.namespace, kubeClient, 30)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    yield `❌ Error creating volume: ${errorMessage}`
    throw error
  }
}
