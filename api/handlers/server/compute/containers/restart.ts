import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import StartContainer, { Input as StartContainerInput } from './start.ts'
import StopContainer, { Input as StopContainerInput } from './stop.ts'

export const Meta = {
  aliases: {
    options: {},
  },
}

export const Input = z.intersection(
  StartContainerInput,
  StopContainerInput,
)

export type Input = z.infer<typeof Input>

export default async function* RestartContainer(request: ServerRequest<Input>): ServerResponse<void> {
  yield* StopContainer(request)
  yield* StartContainer(request)
}
