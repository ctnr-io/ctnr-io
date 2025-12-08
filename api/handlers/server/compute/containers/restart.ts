import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ContainerName } from 'lib/api/schemas.ts'
import start from './start.ts'
import stop from './stop.ts'

export const Meta = {
  aliases: {
    options: {},
  },
}

export const Input = z.object({
  name: ContainerName.meta({ positional: true }),
  force: z.boolean().optional().default(false).describe('Force restart even if insufficient resources'),
})

export type Input = z.infer<typeof Input>

export default async function* (request: ServerRequest<Input>): ServerResponse<void> {
  yield* stop(request)
  yield* start(request)
}
