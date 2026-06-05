import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { Command, ContainerName, Publish } from 'lib/api/schemas.ts'
import { ensureVolume } from 'core/data/storage/volume.ts'
import { hash } from 'node:crypto'
import { VolumeMount } from 'core/schemas/mod.ts'
import { createContainer, deleteContainer, getContainerPod } from 'core/data/compute/container.ts'

export const Meta = {
  aliases: {
    options: {
      'interactive': 'i',
      'terminal': 't',
      'publish': 'p',
      'env': 'e',
      'volume': 'v',
    },
  },
}

export const Input = z.object({
  image: z.string()
    .min(1, 'Containers image cannot be empty')
    // TODO: Add image tag validation when stricter security is needed
    // .regex(/^[a-zA-Z0-9._/-]+:[a-zA-Z0-9._-]+$/, "Container image must include a tag for security")
    // .refine((img) => !img.includes(":latest"), "Using ':latest' tag is not allowed for security reasons")
    .describe('Containers image to run'),
  name: ContainerName.optional(),
  env: z.array(
    z.string()
      .regex(/^[A-Z_][A-Z0-9_]*=.*$/, 'Environment variables must follow format KEY=value with uppercase keys'),
  )
    .optional()
    .describe('Set environment variables'),
  publish: z.array(Publish).optional().describe('Publish format'),
  volume: z.array(VolumeMount).optional().describe(
    'Mount volumes in format name:path:size (e.g., "data:/app/data:5G")',
  ),
  domain: z.string().optional().describe('Domain name for routing'),
  interactive: z.boolean().optional().default(false).describe('Run interactively'),
  terminal: z.boolean().optional().default(false).describe('Run in a terminal'),
  force: z.boolean().optional().default(false).describe('Force recreate the container if it already exists'),
  command: Command.optional().meta({ positional: true }),
  cpu: z.string().regex(/^\d+m?$/, 'CPU limit must be in the format <number>m (e.g., "250m") or <number> (e.g., "1")')
    .default('250m')
    .describe('CPU limit for the container: single number (e.g., 1) or number followed by "m" (e.g., "250m")'),
  memory: z.string()
    .regex(/^\d+[GM]$/, 'Memory limit must be a positive integer followed by "M" or "G" (e.g., "128M", "1G")')
    .default('256M')
    .describe('Memory limit for the container'),
  restart: z.enum(['always', 'on-failure', 'never', 'unless-stopped']).optional().default('never').describe(
    'Restart policy for the container',
  ),
})

export type Input = z.infer<typeof Input>

export default async function* CreateContainer(request: ServerRequest<Input>): ServerResponse<{ name: string }> {
  const { ctx, input, abortSignal } = request

  const {
    image,
    name = hash('sha256', crypto.randomUUID()).substring(0, 12),
    env = [],
    publish,
    volume = [],
    interactive,
    terminal,
    force,
    command,
    cpu,
    memory,
  } = input
  
  const ephemeralStorage = '1G'

  // Parse volume mounts
  const volumeDevices: Array<{ name: string; mountPath: string; size: string }> = []
  for (const vol of volume) {
    const parts = vol.split(':')
    if (parts.length < 2) {
      throw new Error(`Invalid volume format: ${vol}. Use name:path or name:path:size`)
    }

    const [volumeName, mountPath, size = '1G'] = parts
    volumeDevices.push({
      name: volumeName,
      mountPath,
      size,
    })
  }

  // Create PersistentVolumeClaims for volumes that don't exist
  for (const volDevice of volumeDevices) {
    yield* ensureVolume({
      name: volDevice.name,
      size: volDevice.size,
      namespace: ctx.project.namespace,
      kubeClient: ctx.kube.client['karmada'],
    })
  }
  
  const writeCtx = {
    kubeClient: ctx.kube.client['karmada'],
    namespace: ctx.project.namespace
  }
  const readCtx = {
    kubeClient: ctx.kube.client[ctx.project.cluster],
    namespace: ctx.project.namespace
  }

  // Check if pod already exists
  const existingPod = await getContainerPod(readCtx, name).catch(() => null)

  // If Pod already exists and force is true, delete it first
  if (existingPod && !force) {
    throw new Error(`Container with name ${name} already exists. Use --force to recreate.`)
  } else if (force) {
    yield ctx.log.loader(`🔄 Recreating container ${name}...`)
   await deleteContainer(writeCtx, name, abortSignal!) 
  } else {
    yield ctx.log.loader(`⚡️ Creating container ${name}...`)
  }

  // Build the pod using the transform function
  await createContainer({
    kubeClient: ctx.kube.client['karmada'],
    namespace: ctx.project.namespace,
  }, {
    name,
    namespace: ctx.project.namespace,
    image,
    env,
    publish: publish?.map((p) => ({
      name: p.name || `port-${p.port}`,
      port: Number(p.port),
      protocol: p.protocol,
    })),
    volume: volumeDevices,
    interactive,
    terminal,
    command,
    cpu,
    memory,
    ephemeralStorage,
  }, abortSignal)

  return { name }
}
