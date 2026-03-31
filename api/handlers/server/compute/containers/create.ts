import { z } from 'zod'
import { Deployment } from '@cloudydeno/kubernetes-apis/apps/v1'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ServerContext } from 'api/context/mod.ts'
import { ContainerName, Publish } from 'lib/api/schemas.ts'
import { ensureVolume } from 'core/data/storage/volume.ts'
import { containerInputToDeployment } from 'core/transform/container.ts'
import { hash } from 'node:crypto'
import { VolumeMount } from 'core/schemas/mod.ts'

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
    .describe('Containers image to run')
    .meta({ positional: true }),
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
  command: z.string()
    .max(1000, 'Command length is limited for security reasons')
    .optional()
    .describe('Command to run in the container'),
  replicas: z.union([
    z.number().min(1).max(20),
    z.string().regex(/^\d+-\d+$/, 'Replicas range must be in format "min-max" (e.g., "1-5")'),
  ])
    .optional()
    .default(1)
    .describe('Number of replicas: single number (e.g., 3) or range (e.g., "1-5" for min-max)'),
  cpu: z.string().regex(/^\d+m?$/, 'CPU limit must be in the format <number>m (e.g., "250m") or <number> (e.g., "1")')
    .default('250m')
    .describe('CPU limit for the container: single number (e.g., 1) or number followed by "m" (e.g., "250m")'),
  memory: z.string()
    .regex(/^\d+[GM]$/, 'Memory limit must be a positive integer followed by "M" or "G" (e.g., "128M", "1G")')
    .default('256M')
    .describe('Memory limit for the container'),
  restart: z.enum(['always', 'on-failure', 'never']).optional().default('never').describe(
    'Restart policy for the container',
  ),
})

export type Input = z.infer<typeof Input>

export default async function* (request: ServerRequest<Input>): ServerResponse<{ name: string }> {
  const { ctx, input, signal } = request

  const {
    image,
    name = image.split(':')[0].replace(/[^a-z0-9]/gi, '-').toLowerCase() + '-' + hash("sha256", crypto.randomUUID()).substring(0, 6),
    env = [],
    publish,
    volume = [],
    interactive,
    terminal,
    force,
    command,
    replicas,
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

  // Build the deployment using the transform function
  const deploymentResource = containerInputToDeployment({
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
    replicas,
    cpu,
    memory,
    ephemeralStorage,
  })

  // Start with 0 replicas, will be updated when starting
  if (deploymentResource.spec) {
    deploymentResource.spec.replicas = 0
  }

  // Check if the deployment already exists
  let deployment = await ctx.kube.client['karmada'].AppsV1.namespace(ctx.project.namespace).getDeployment(name).catch(
    () => null
  )
  if (deployment) {
    if (force) {
      yield `🗑️  Deleting existing containers ${name}...`
      await Promise.all([
        // Wait for deployment to be fully deleted
        waitForDeploymentDeletion({ ctx, name, signal }),
        ctx.kube.client['karmada'].AppsV1.namespace(ctx.project.namespace).deleteDeployment(name, {
          abortSignal: signal,
          gracePeriodSeconds: 0, // Force delete immediately
          propagationPolicy: 'Foreground', // Ensure all resources are cleaned up
        }),
        ctx.kube.client['karmada'].CoreV1.namespace(ctx.project.namespace).deletePodList({
          labelSelector: `ctnr.io/name=${name}`,
          abortSignal: signal,
          gracePeriodSeconds: 0, // Force delete immediately
        }),
      ])
    } else {
      yield `⚠️ Containers ${name} already exists. Use --force to recreate.`
      return { name }
    }
  }

	  // Initialize the deployment
  yield `✍️  Initializing containers ${name}...`
  await ctx.kube.client['karmada'].AppsV1.namespace(ctx.project.namespace).createDeployment(deploymentResource, {
    abortSignal: signal,
  })
  // Wait for deployment to be ready
  deployment = await waitForDeployment({
    ctx,
    name,
    predicate: (deployment) => {
      const status = deployment.status
      return !!status
    },
    signal,
  })

  return { name }
}

async function waitForDeploymentDeletion(
  { ctx, name, signal }: { ctx: ServerContext; name: string; signal: AbortSignal },
): Promise<void> {
  const deploymentWatcher = await ctx.kube.client['karmada'].AppsV1.namespace(ctx.project.namespace)
    .watchDeploymentList({
      labelSelector: `ctnr.io/name=${name}`,
      abortSignal: signal,
    })
  const reader = deploymentWatcher.getReader()
  while (true) {
    const { done, value } = await reader.read()
    const deployment = value?.object as Deployment
    if (value?.type === 'DELETED' && deployment?.metadata?.name === name) {
      console.debug(`Deployment ${name} deleted`)
      break
    }
    if (done) {
      return
    }
  }
}

async function waitForDeployment({ ctx, name, predicate, signal }: {
  ctx: ServerContext
  name: string
  predicate: (deployment: Deployment) => boolean | Promise<boolean>
  signal: AbortSignal
}): Promise<Deployment> {
  const deploymentWatcher = await ctx.kube.client['karmada'].AppsV1.namespace(ctx.project.namespace).watchDeploymentList({
    labelSelector: `ctnr.io/name=${name}`,
    abortSignal: signal,
  })
  const reader = deploymentWatcher.getReader()
  while (true) {
    const { done, value } = await reader.read()
    const deployment = value?.object as Deployment
    if (deployment?.metadata?.name === name && await predicate(deployment)) {
      return deployment
    }
    if (done) {
      return deployment
    }
  }
}