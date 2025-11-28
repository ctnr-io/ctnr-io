import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { deleteVolume, isVolumeExists } from 'core/data/storage/volume.ts'

export const Meta = {
  aliases: {
    options: {},
  },
}

export const Input = z.object({
  name: z.string()
    .min(1, 'Volume name is required')
    .describe('Name of the volume to delete'),
  force: z.boolean()
    .optional()
    .default(false)
    .describe('Force delete even if volume is attached'),
})

export type Input = z.infer<typeof Input>

export default async function* (
  { ctx, input }: ServerRequest<Input>,
): ServerResponse<void> {
  const { name, force: _force = false } = input
  const { namespace } = ctx.project
  const kubeClient = ctx.kube.client.karmada

  try {
    // Check if volume exists
    const exists = await isVolumeExists(name, namespace, kubeClient)
    if (!exists) {
      throw new Error(`Volume ${name} not found`)
    }

    // Delete the volume
    for await (const message of deleteVolume(name, namespace, kubeClient)) {
      yield message
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    yield `Error deleting volume: ${errorMessage}`
    throw error
  }
}
