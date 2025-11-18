import z from 'zod'

export const gatewayListeners = [
  'http',
  'https',
  'tls',
  'grpc',
] as const

// ShortUUID (25-character base36) regex
export const Id = z.string().regex(/^[a-z0-9]{25}$/, 'ID must be a valid ShortUUID (25-character base36)')

export const Name = z.string().regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, 'Name must be valid DNS-1123 label')
  .min(1, 'Name cannot be empty')
  .max(63, 'Name cannot exceed 63 characters')
  .describe('Name conform to DNS-1123 label standard')

export const ContainerName = Name
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

export const ClusterNames = ['eu-0', 'eu-1', 'eu-2'] as const
export const ClusterName = z.enum(ClusterNames).transform(
  (value) =>
    !value ? ClusterNames[Math.floor(Math.random() * 10 % ClusterNames.length)] : value as typeof ClusterNames[number],
)
export type ClusterName = z.infer<typeof ClusterName>

export const Project = z.object({
  id: Id.describe('Project unique identifier'),
  name: Name.describe('Project name'),
  ownerId: z.string().describe('Owner user unique identifier'),
})

export type Project = z.infer<typeof Project>