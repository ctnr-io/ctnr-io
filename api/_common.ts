import { z } from 'zod'
import { ClientContext, ServerContext } from 'ctx/mod.ts'
import { ts } from '@tmpl/core'

export const gatewayListeners = [
  'http',
  'https',
  'tls',
  'grpc',
] as const

export const ContainerName = z.string()
  .min(1, 'Container name cannot be empty')
  .max(63, 'Container name cannot exceed 63 characters')
  .regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, 'Container name must be valid DNS-1123 label')
  .describe('Name of the container')

export const PortProtocol = z.enum(['tcp', 'udp'])
  .describe("Protocol for the port, defaults to 'tcp' if not specified")

export const PortNumber = z.number()
  // TODO: Add port restrictions when stricter security is needed
  // .min(1024, "Only unprivileged ports (>= 1024) are allowed for security")
  .max(65535, 'Port number must be valid')

export const PortName = z.string().regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, 'Port name must be valid DNS-1123 label')
  .describe('Name of the port')

const PublishSchema = z.object({
  name: PortName.optional(),
  port: PortNumber,
  protocol: PortProtocol.optional().default('tcp'),
})

export const Publish = z.string().transform((value) => {
  const [portAndProtocol, name] = value.split(':').toReversed()
  const [port, protocol] = portAndProtocol.split('/')
  return {
    name: name || undefined,
    port: PortNumber.parse(parseInt(port)),
    protocol: PortProtocol.optional().parse(protocol),
  }
}).refine(PublishSchema.parse).describe(
  `[<name>:]<number>[/<protocol>], where <name> is optional and <protocol> is either 'tcp' or 'udp'. Example: "my-tcp-port:8080/tcp" or "my-udp-port:8080/udp"`,
)

export type ServerRequest<Input> = { ctx: ServerContext; input: Input }

export type ServerResponse<Output> = AsyncGenerator<
  string,
  Output,
  unknown
>

export type ClientRequest<Input> = { ctx: ClientContext; input: Input }

export type ClientResponse<Output = void> = AsyncGenerator<
  string,
  Output,
  unknown
>
