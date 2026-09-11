import { z } from 'zod'
import { stringify } from '@std/yaml'
import { parseComposeFile } from 'core/transform/compose.ts'
import { ClientContext } from 'api/context/mod.ts'
import { ClientRequest, ClientResponse } from 'lib/api/types.ts'

export const Meta = {} as const

export const Input = z.object({
  file: z.string().meta({ positional: true }).describe('Path to a docker-compose.yaml file'),
  name: z.string().optional().describe('Stack name to use if the compose file has none'),
  output: z.enum(['yaml', 'json']).default('yaml').optional(),
})
export type Input = z.infer<typeof Input>

export type Output = string

/**
 * Parse a docker-compose.yaml file and print it as a ctnr Stack definition.
 * This is a local, offline mapping: no cluster round-trip is made.
 */
export default async function* compose(
  { input }: ClientRequest<Input, ClientContext>,
): ClientResponse<Output> {
  yield `📄 Reading ${input.file}...`
  const content = await Deno.readTextFile(input.file)
  const defaultName = input.name ?? input.file.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'stack'

  const stack = parseComposeFile(content, defaultName)

  const rendered = input.output === 'json' ? JSON.stringify(stack, null, 2) : stringify(stack)
  yield `✅ Mapped ${Object.keys(stack.services).length} service(s) into stack "${stack.name}"`
  console.info(rendered)
  return rendered
}
