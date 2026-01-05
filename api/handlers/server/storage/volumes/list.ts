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

type OutputType = NonNullable<z.infer<typeof Input>['output']>

export type Input<T extends OutputType> = z.infer<typeof Input> & {
  output?: T
}

type Output<Type extends 'raw' | 'json' | 'yaml' | 'name' | 'wide'> = {
  'raw': Volume[]
  'json': string
  'yaml': string
  'name': string
  'wide': void
}[Type]

export default async function* listVolumesApiHandler<T extends OutputType = 'raw'>(
  { ctx, input }: ServerRequest<Input<T>>,
): ServerResponse<Output<T>> {
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
      return volumes as Output<T>

    case 'json':
      return JSON.stringify(volumes, null, 2) as Output<T>

    case 'yaml':
      return YAML.stringify(volumes) as Output<T>

    case 'name':
      return volumes.map((vol) => vol.name).join('\n') as Output<T>

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
        yield volume.name.padEnd(20) +
          volume.size.padEnd(10) +
          volume.status.padEnd(12) +
          age
      }
      return (void 0) as Output<T>
  }
}
