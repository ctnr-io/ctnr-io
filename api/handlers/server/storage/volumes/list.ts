import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import * as YAML from '@std/yaml'
import { listVolumes, type VolumeContext } from 'core/data/storage/volume.ts'
import { formatAge } from 'lib/api/formatter.ts'
import type { Volume } from 'core/schemas/storage/volume.ts'

export const Meta = {
  aliases: {
    options: {
      output: 'o',
    },
  },
}

export const Input = z.object({
  output: z.enum(['wide', 'name', 'json', 'yaml', 'raw']).optional(),
  name: z.string().optional(),
})

export type Input = z.infer<typeof Input>

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
  const { output = 'raw', name } = input

  // Create context for core/data
  const volumeCtx: VolumeContext = {
    kubeClient: ctx.kube.client['karmada'],
    namespace: ctx.project.namespace,
  }

  // Fetch volumes using core/data
  const volumes = await listVolumes(volumeCtx, { name })

  switch (output) {
    case 'raw':
      return volumes

    case 'json':
      return JSON.stringify(volumes, null, 2)

    case 'yaml':
      return YAML.stringify(volumes)

    case 'name':
      return volumes.map((vol) => vol.name).join('\n')

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
        const age = formatAge(volume.createdAt)
        const attachedToStr = volume.attachedTo?.join(', ') || 'none'
        yield volume.name.padEnd(20) +
          volume.size.padEnd(10) +
          volume.status.padEnd(12) +
          attachedToStr.padEnd(15) +
          age
      }
      return
  }
}
