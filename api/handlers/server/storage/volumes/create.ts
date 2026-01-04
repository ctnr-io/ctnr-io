import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ensureVolume, isVolumeExists, waitForVolumeReady } from 'core/data/storage/volume.ts'
import { VolumeSize } from 'core/schemas/storage/volume.ts'

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
  size: VolumeSize.describe('Size of the volume, e.g., 10Gi'),
})

export type Input = z.infer<typeof Input>

export default async function* (
  { ctx, input }: ServerRequest<Input>,
): ServerResponse<void> {
  const { name, size } = input

  try {
    // Check if volume already exists
    const exists = await isVolumeExists(name, ctx.project.namespace, ctx.kube.client.karmada)
    if (exists) {
      throw new Error(`Volume ${name} already exists`)
    }

    // Create the volume using ensureVolume
    for await (
      const message of ensureVolume({
        name,
        size,
        namespace: ctx.project.namespace,
        kubeClient: ctx.kube.client.karmada,
      })
    ) {
      yield message
    }

    // Wait for the volume to be ready
    for await (
      const message of waitForVolumeReady(
        name,
        ctx.project.namespace,
        ctx.kube.client.karmada,
        30,
      )
    ) {
      yield message
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    yield `❌ Error creating volume: ${errorMessage}`
    throw error
  }
}
