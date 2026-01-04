import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ContainerName, Publish } from 'lib/api/schemas.ts'
import { getDeployment } from 'core/data/compute/container.ts'
import { containerInputToDeployment } from 'core/transform/container.ts'
import { ensureVolume } from 'core/data/storage/volume.ts'
import { VolumeMount } from 'core/schemas/mod.ts'
import { normalizeQuantity } from 'core/transform/resources.ts'

export const Meta = {
  aliases: {
    options: {
      'interactive': 'i',
      'terminal': 't',
      'publish': 'p',
    },
  },
}

export const Input = z.object({
  name: ContainerName.meta({ positional: true }),
  image: z.string()
    .min(1, 'Container image cannot be empty')
    .describe('Container image to run')
    .optional(),
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

export default async function* rolloutContainer(request: ServerRequest<Input>): ServerResponse<void> {
  const { ctx, input, signal } = request
  const {
    name: containerName,
    image: inputImage,
    env: inputEnv,
    publish: inputPublish,
    volume: inputVolume,
    interactive: inputInteractive,
    terminal: inputTerminal,
    command: inputCommand,
    replicas: inputReplicas,
    cpu: inputCpu,
    memory: inputMemory,
  } = input

  const containerCtx = {
    kubeClient: ctx.kube.client.karmada,
    namespace: ctx.project.namespace,
  }

  // Fetch deployment to verify it exists and get current configuration
  const existingDeployment = await getDeployment(containerCtx, containerName)
  if (!existingDeployment) {
    throw new Error(`Deployment '${containerName}' not found`)
  }

  const currentReplicas = existingDeployment.spec?.replicas ?? 0
  if (currentReplicas === 0) {
    throw new Error(`Cannot rollout stopped container '${containerName}'. Start it first.`)
  }

  yield `🔄 Rolling out container '${containerName}'...`

  // Extract current configuration from existing deployment
  const existingContainer = existingDeployment.spec?.template?.spec?.containers?.[0]
  const existingAnnotations = existingDeployment.metadata?.annotations ?? {}

  // Merge configuration: use input if provided, otherwise use existing
  const image = inputImage || existingContainer?.image || '' 

  // Use normalizeQuantity to safely extract resource values from Kubernetes objects
  const cpu = inputCpu ?? (normalizeQuantity(existingContainer?.resources?.limits?.cpu) || '250m')
  const memory = inputMemory ?? (normalizeQuantity(existingContainer?.resources?.limits?.memory) || '256M')

  // Safely extract ephemeral-storage, handling invalid values
  const ephemeralStorage = normalizeQuantity(existingContainer?.resources?.limits?.['ephemeral-storage']) || '1G'

  const interactive = inputInteractive ?? (existingContainer?.stdin || false)
  const terminal = inputTerminal ?? (existingContainer?.tty || false)
  const command = inputCommand ??
    (existingContainer?.command?.[1] === '-c' ? existingContainer?.command?.[2] : undefined)

  // Merge environment variables
  const existingEnv = existingContainer?.env?.map((e) => `${e.name}=${e.value}`) ?? []
  const env = inputEnv && inputEnv.length > 0 ? inputEnv : existingEnv

  // Merge replicas
  const existingMinReplicas = parseInt(existingAnnotations['ctnr.io/min-replicas'] ?? '1', 10)
  const existingMaxReplicas = parseInt(existingAnnotations['ctnr.io/max-replicas'] ?? '1', 10)
  const existingReplicasRange = existingMinReplicas === existingMaxReplicas
    ? existingMinReplicas
    : `${existingMinReplicas}-${existingMaxReplicas}`
  const replicas = inputReplicas ?? existingReplicasRange

  // Merge ports
  const existingPorts = existingContainer?.ports?.map((p) => ({
    name: p.name || `port-${p.containerPort}`,
    port: p.containerPort!,
    protocol: p.protocol?.toLowerCase() as 'tcp' | 'udp' | undefined,
  })) ?? []
  const publish = inputPublish?.map((p) => ({
    name: p.name || `port-${p.port}`,
    port: Number(p.port),
    protocol: p.protocol,
  })) ?? existingPorts

  // Merge volumes
  const existingVolumes = existingContainer?.volumeMounts?.map((vm) => {
    const volumeName = vm.name
    return {
      name: volumeName,
      mountPath: vm.mountPath,
      size: '1G', // Size is not stored in deployment, use default
    }
  }) ?? []

  // Parse input volume mounts
  const inputVolumeDevices: Array<{ name: string; mountPath: string; size: string }> = []
  for (const vol of (inputVolume ?? [])) {
    const parts = vol.split(':')
    if (parts.length < 2) {
      throw new Error(`Invalid volume format: ${vol}. Use name:path or name:path:size`)
    }

    const [volumeName, mountPath, size = '1G'] = parts
    inputVolumeDevices.push({
      name: volumeName,
      mountPath,
      size,
    })
  }

  const volumeDevices = inputVolumeDevices.length > 0 ? inputVolumeDevices : existingVolumes

  // Create PersistentVolumeClaims for volumes that don't exist
  for (const volDevice of volumeDevices) {
    yield* ensureVolume({
      name: volDevice.name,
      size: volDevice.size,
      namespace: ctx.project.namespace,
      kubeClient: ctx.kube.client['karmada'],
    })
  }

  yield `   Merging with existing configuration...`

  // Build the full deployment spec using the transform function with merged config
  const deploymentSpec = containerInputToDeployment({
    name: containerName,
    namespace: ctx.project.namespace,
    image,
    env,
    publish,
    volume: volumeDevices,
    interactive,
    terminal,
    command,
    replicas,
    cpu,
    memory,
    ephemeralStorage,
  })

  // Preserve the current replica count from the existing deployment
  if (deploymentSpec.spec) {
    deploymentSpec.spec.replicas = currentReplicas
  }

  // Add restart annotation to trigger rolling update
  const restartedAt = new Date().toISOString()
  if (deploymentSpec.spec?.template?.metadata?.annotations) {
    deploymentSpec.spec.template.metadata.annotations['kubectl.kubernetes.io/restartedAt'] = restartedAt
  } else if (deploymentSpec.spec?.template?.metadata) {
    deploymentSpec.spec.template.metadata.annotations = {
      'kubectl.kubernetes.io/restartedAt': restartedAt,
    }
  }

  // Create a minimal patch object with only the spec and metadata annotations we want to update
  const patchObject = {
    metadata: {
      annotations: deploymentSpec.metadata?.annotations || {},
    },
    spec: deploymentSpec.spec,
  }

  // Patch the deployment with only the necessary fields
  await containerCtx.kubeClient.AppsV1.namespace(containerCtx.namespace).patchDeployment(
    containerName,
    'strategic-merge',
    patchObject,
    {
      abortSignal: signal,
    },
  )

  yield `✅ Rollout initiated for container '${containerName}'`
  yield `   Updated deployment with new configuration`
  yield `   Kubernetes will perform a rolling update with zero downtime`
  yield `   Old pods will be terminated only after new pods are ready`
}
