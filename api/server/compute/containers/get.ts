import { ContainerName } from 'lib/api/schemas.ts'
import listContainers, * as ListContainers from './list.ts'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import z from 'zod'

export const Meta = {
  aliases: {
    options: {
      output: 'o',
    },
  },
}

export const Input = ListContainers.Input.extend({
  // The name of the container to get details for
  name: ContainerName,
})

type OutputType = NonNullable<z.infer<typeof Input>['output']>

export type Input<T extends OutputType> = z.infer<typeof Input> & {
  output?: T
}

export type Output<T extends OutputType> = {
  'raw': ListContainers.ContainerData
  'json': string
  'yaml': string
  'name': string
  'wide': void
}[T]

export default async function* getContainer<T extends OutputType = 'raw'>(
  request: ServerRequest<Input<T>>,
): ServerResponse<Output<T>> {
  const containers = yield* listContainers<T>(request)
  if (request.input.output === undefined || request.input.output === 'raw') {
    return containers?.[0] as Output<T>
  }
  return containers as any as Output<T>
}
