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
    .max(63, 'Volume name must be 63 characters or less')
    .regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, 'Volume name must be lowercase alphanumeric with hyphens'),
  size: z.string()
    .regex(/^\d+[KMGT]?i?$/, 'Size must be in format like 10Gi, 500Mi, 1Ti')
    .describe('Volume size (e.g., 10Gi, 500Mi, 1Ti)'),
  mountPath: z.string().describe('Path to mount the volume'),
})

export type Input = z.infer<typeof Input>

export default async function* (
  { ctx, input }: ServerRequest<Input>,
): ServerResponse<void> {
  const { name, size, mountPath } = input

  const volumeRepo = new VolumeRepository(ctx.kube.client, ctx.project)

  try {
    // Check if volume already exists
    const exists = await volumeRepo.exists(name)
    if (exists) {
      throw new Error(`Volume ${name} already exists`)
    }

    yield `Creating volume ${name} with size ${size}...`

    // Create the volume using repository
    await volumeRepo.create({
      name,
      size,
      mountPath,
    })

    yield `Volume ${name} created successfully`
    yield `  Size: ${size}`

    // Wait for the volume to be ready
    yield `Waiting for volume ${name} to be provisioned...`

    const status = await volumeRepo.waitForReady(name, 30)

    if (status === 'Bound') {
      yield `Volume ${name} is now available and ready to use`
    } else if (status === 'Failed') {
      throw new Error(`Volume provisioning failed`)
    } else {
      yield `Volume ${name} created but still provisioning. This may take a few more moments.`
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    yield `❌ Error creating volume: ${errorMessage}`
    throw error
  }
}
