import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { VolumeRepository } from 'core/repositories/mod.ts'

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
  const { name, force = false } = input

  const volumeRepo = new VolumeRepository(ctx.kube.client, ctx.project)

  try {
    yield `Deleting volume ${name}...`

    // Check if volume exists
    const volume = await volumeRepo.get(name)
    if (!volume) {
      throw new Error(`Volume ${name} not found`)
    }

    // Check if volume is attached to any containers (unless force is true)
    if (!force) {
      const attachedTo = await volumeRepo.getAttachedContainer(name)
      if (attachedTo) {
        throw new Error(
          `Volume ${name} is currently attached to container "${attachedTo}". ` +
            `Detach the volume first or use --force to delete anyway.`,
        )
      }

      // Check if volume is in use by any pods
      const podsUsingVolume = await volumeRepo.getPodsUsingVolume(name)
      if (podsUsingVolume.length > 0) {
        const podNames = podsUsingVolume.join(', ')
        throw new Error(
          `Volume ${name} is currently in use by pods: ${podNames}. ` +
            `Stop the containers first or use --force to delete anyway.`,
        )
      }
    }

    // Perform the deletion
    yield `Removing volume ${name}...`

    await volumeRepo.delete(name)

    yield `Volume ${name} deletion initiated`

    // Wait for the volume to be fully deleted (with timeout)
    yield `Waiting for volume to be fully removed...`

    const deleted = await volumeRepo.waitForDeletion(name, 30)

    if (deleted) {
      yield `Volume ${name} has been successfully deleted`
    } else {
      yield `Volume ${name} deletion is in progress. It may take a few more moments to complete.`
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    yield `Error deleting volume: ${errorMessage}`
    throw error
  }
}
