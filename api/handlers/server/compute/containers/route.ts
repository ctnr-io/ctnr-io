import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ContainerName, PortName } from 'lib/api/schemas.ts'
import createRoute from 'api/handlers/server/network/routes/create.ts'

export const Meta = {
  aliases: {
    options: {
      port: 'p',
    },
  },
}

export const Input = z.object({
  name: ContainerName.meta({ positional: true }),
  domain: z.string().regex(/^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,})+$/).optional().describe(
    'Parent domain name for the routing',
  ),
  port: z.array(PortName).optional().describe(
    'Ports to expose, defaults to all ports of the container',
  ),
})

export type Input = z.infer<typeof Input>

export default async function* routeContainer(request: ServerRequest<Input>): ServerResponse<void> {
  yield* createRoute({
    ...request,
    input: {
      ...request.input,
      name: request.input.name,
      container: request.input.name,
    },
  })
}
