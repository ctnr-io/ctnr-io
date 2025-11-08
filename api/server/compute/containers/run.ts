import { z } from 'zod'
import { Pod } from '@cloudydeno/kubernetes-apis/core/v1'
import { Deployment } from '@cloudydeno/kubernetes-apis/apps/v1'
import { toQuantity } from '@cloudydeno/kubernetes-apis/common.ts'
import attach from './attach.ts'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import * as Route from './route.ts'
import logs from './logs.ts'
import { getPodsFromAllClusters } from './_utils.ts'
import { ServerContext } from 'ctx/mod.ts'
import { ClusterName, ClusterNames, ContainerName, Publish } from 'lib/api/schemas.ts'
import { createVolume } from 'lib/storage/volume.ts'
import start from './start.ts'

export const Meta = {
  aliases: {
    options: {
      'interactive': 'i',
      'terminal': 't',
      'publish': 'p',
    },
  },
}

// Volume mount specification
const VolumeMount = z.string()
  .regex(
    /^[a-z0-9]([-a-z0-9]*[a-z0-9])?:\/[^:]*(?::\d+[G]?)?$/,
    'Volume format must be name:path or name:path:size (e.g., "data:/app/data" or "data:/app/data:5G")',
  )
  .describe('Volume mount in format name:path:size (size optional, defaults to 1G)')

export const Input = z.object({
  name: ContainerName,
  image: z.string()
    .min(1, 'Containers image cannot be empty')
    // TODO: Add image tag validation when stricter security is needed
    // .regex(/^[a-zA-Z0-9._/-]+:[a-zA-Z0-9._-]+$/, "Container image must include a tag for security")
    // .refine((img) => !img.includes(":latest"), "Using ':latest' tag is not allowed for security reasons")
    .describe('Containers image to run'),
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
  route: z.array(z.string())
    .optional().describe(
      "Route container's published ports. Format is <port-name> or <port-number>. If not specified, all published ports are routed.",
    ),
  domain: z.string().optional().describe('Domain name for routing'),
  interactive: z.boolean().optional().default(false).describe('Run interactively'),
  terminal: z.boolean().optional().default(false).describe('Run in a terminal'),
  detach: z.boolean().optional().default(false).describe('Detach from the container after starting'),
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
  cluster: ClusterName.optional().describe('Clusters to run the containers on'),
  restart: z.enum(['always', 'on-failure', 'never']).optional().default('never').describe(
    'Restart policy for the container',
  ),
})

export type Input = z.infer<typeof Input>

export default async function* (request: ServerRequest<Input>): ServerResponse<void> {
  const { ctx, input, signal, defer } = request

  const {
    name,
    image,
    env = [],
    publish,
    volume = [],
    interactive,
    terminal,
    detach,
    force,
    command,
    replicas,
    cpu,
    memory,
    cluster = ClusterNames[Math.floor(Math.random() * 10 % ClusterNames.length)],
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

  // Parse replicas parameter
  let replicaCount: number
  let minReplicas: number
  let maxReplicas: number

  if (typeof replicas === 'string') {
    // Range format: "1-5"
    const [min, max] = replicas.split('-').map(Number)
    minReplicas = min
    maxReplicas = max
    replicaCount = min // Start with minimum
  } else {
    // Single number
    replicaCount = replicas as number
    minReplicas = replicaCount
    maxReplicas = replicaCount
  }

  const labels: Record<string, string> = {}
  labels['ctnr.io/owner-id'] = ctx.auth.user.id
  labels['ctnr.io/name'] = name
  labels[`cluster.ctnr.io/${cluster}`] = 'true'

  const annotations: Record<string, string> = {}
  annotations['ctnr.io/min-replicas'] = minReplicas.toString()
  annotations['ctnr.io/max-replicas'] = maxReplicas.toString()

  // Create PersistentVolumeClaims for volumes that don't exist
  for (const volDevice of volumeDevices) {
    yield* createVolume({
      name: volDevice.name,
      size: volDevice.size,
      mountPath: volDevice.mountPath,
      userId: ctx.auth.user.id,
      namespace: ctx.kube.namespace,
      kubeClient: ctx.kube.client['karmada'],
      cluster: cluster,
    })
  }

  const deploymentResource: Deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name,
      namespace: ctx.kube.namespace,
      labels,
      annotations,
    },
    spec: {
      // Start with 0 replicas, will be updated when starting
      replicas: 0,
      selector: {
        matchLabels: {
          'ctnr.io/name': name,
          'ctnr.io/type': 'container',
        },
      },
      template: {
        metadata: {
          labels: {
            'ctnr.io/owner-id': ctx.auth.user.id,
            'ctnr.io/name': name,
            'ctnr.io/type': 'container',
          },
        },
        spec: {
          restartPolicy: 'Always', // Deployments use Always restart policy
          // Enable gVisor runtime for additional container isolation
          // runtimeClassName: "gvisor", // Uncommented for enhanced security
          hostNetwork: false, // Do not use host network
          hostPID: false, // Do not share host PID namespace
          hostIPC: false, // Do not share host IPC namespace
          hostUsers: false, // Do not use host users, prevent root escalation
          automountServiceAccountToken: false, // Prevent user access to kubernetes API
          containers: [
            {
              name,
              image,
              stdin: interactive,
              tty: terminal,
              command: command ? ['sh', '-c', command] : undefined,
              env: env.length === 0 ? [] : env.map((e) => {
                const [name, value] = e.split('=')
                return { name, value }
              }),
              ports: publish?.map((p) => ({
                name: p.name,
                containerPort: Number(p.port),
                protocol: p.protocol?.toUpperCase() as 'TCP' | 'UDP',
              })),
              volumeDevices: volumeDevices.map((vol) => ({
                name: vol.name,
                devicePath: vol.mountPath,
              })),
              readinessProbe: {
                exec: {
                  command: ['true'],
                },
              },
              livenessProbe: {
                exec: {
                  command: ['true'],
                },
              },
              startupProbe: {
                exec: {
                  command: ['true'],
                },
              },
              // Enhanced container-level security ctx
              securityContext: {
                allowPrivilegeEscalation: false, // Prevent privilege escalation
                privileged: false, // Explicitly disable privileged mode
                // readOnlyRootFilesystem: true, // Make root filesystem read-only
                // runAsNonRoot: true, // Ensure container runs as non-root
                // runAsUser: 65534, // Run as nobody user
                // runAsGroup: 65534, // Run as nobody group
                capabilities: {
                  drop: ['ALL'], // Drop all capabilities
                  // Add specific capabilities only if needed
                  add: [
                    'CHOWN',
                    'DAC_OVERRIDE',
                    'FOWNER',
                    'FSETID',
                    'KILL',
                    'NET_BIND_SERVICE',
                    'SETGID',
                    'SETUID',
                    'AUDIT_WRITE',
                  ],
                },
              },
              // Enhanced resource limits to prevent resource exhaustion attacks
              resources: {
                limits: {
                  // CPU & Memory are namespaced scoped
                  cpu: toQuantity(cpu), // 125 milliCPU (increased from 100m for better performance)
                  memory: toQuantity(memory), // 256 MiB (increased from 256Mi)
                  'ephemeral-storage': toQuantity(ephemeralStorage), // Limit ephemeral storage
                  // TODO: Add GPU limits when GPU resources are available
                  // "nvidia.com/gpu": new Quantity(1, ""),
                },
                requests: {
                  // CPU & Memory are namespaced scoped
                  cpu: toQuantity(cpu), // 125 milliCPU (increased from 100m for better performance)
                  memory: toQuantity(memory), // 256 MiB (increased from 256Mi)
                  'ephemeral-storage': toQuantity(ephemeralStorage), // Limit ephemeral storage
                  // TODO: Add GPU limits when GPU resources are available
                  // "nvidia.com/gpu": new Quantity(1, ""),
                },
              },
            },
          ],
          volumes: volumeDevices.map((vol) => ({
            name: vol.name,
            persistentVolumeClaim: {
              claimName: vol.name,
            },
          })),
          // TODO: Add topology spread constraints for better distribution
          // topologySpreadConstraints: [
          //   {
          //     maxSkew: 1,
          //     topologyKey: "ctx.kube.client['karmada'].io/hostname",
          //     whenUnsatisfiable: "DoNotSchedule",
          //     labelSelector: {
          //       matchLabels: {
          //         "ctnr.io/name": name
          //       }
          //     }
          //   }
          // ],
          // Set DNS policy for better network security
          dnsPolicy: 'ClusterFirst',
          // TODO: Configure custom DNS when needed for additional security
          // dnsConfig: {
          //   nameservers: ["8.8.8.8", "8.8.4.4"],
          //   searches: ["default.svc.cluster.local"],
          //   options: [
          //     {
          //       name: "ndots",
          //       value: "2"
          //     }
          //   ]
          // },
        },
      },
    },
  }

  // Check if the deployment already exists
  let deployment = await ctx.kube.client['karmada'].AppsV1.namespace(ctx.kube.namespace).getDeployment(name).catch(() =>
    null
  )
  if (deployment) {
    if (force) {
      yield `🗑️  Deleting existing containers ${name}...`
      await Promise.all([
        // Wait for deployment to be fully deleted
        waitForDeploymentDeletion({ ctx, name, signal }),
        ctx.kube.client['karmada'].AppsV1.namespace(ctx.kube.namespace).deleteDeployment(name, {
          abortSignal: signal,
          gracePeriodSeconds: 0, // Force delete immediately
          propagationPolicy: 'Foreground', // Ensure all resources are cleaned up
        }),
        ctx.kube.client['karmada'].CoreV1.namespace(ctx.kube.namespace).deletePodList({
          labelSelector: `ctnr.io/name=${name}`,
          abortSignal: signal,
          gracePeriodSeconds: 0, // Force delete immediately
        }),
      ])
    } else {
      yield `⚠️ Containers ${name} already exists. Use --force to recreate.`
      return
    }
  }

  // Initialize the deployment
  yield `✍️  Initializing containers ${name}...`
  await ctx.kube.client['karmada'].AppsV1.namespace(ctx.kube.namespace).createDeployment(deploymentResource, {
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

  // Start the deployment
  yield* start({
    ctx,
    input,
    signal,
    defer,
  })

  yield `\r\nContainers ${name} is running with ${replicaCount} replica(s).`

  // Get the first pod for interactive/terminal operations
  let pod: Pod | null = null
  if (interactive || terminal || !detach) {
    // Use the same multi-cluster approach as logs/attach/exec
    try {
      const pods = await getPodsFromAllClusters({
        ctx,
        name,
        signal,
      })
      pod = pods.length > 0 ? pods[0].pod : null
    } catch (error) {
      console.warn(`Failed to get pods from clusters:`, error)
      // Fallback to checking eu cluster directly
      const pods = await ctx.kube.client['karmada'].CoreV1.namespace(ctx.kube.namespace).getPodList({
        labelSelector: `ctnr.io/name=${name}`,
      })
      pod = pods.items.find((p) => p.status?.phase === 'Running') || null
    }
  }

  // Note: Service management is now handled by the route command
  // The --publish flag only affects container port configuration
  if (publish && publish.length > 0) {
    yield `Containers ports are available for routing.`

    if (input.route) {
      yield `Route container ports ${name}...`
      // Route the container's published ports to a domain
      try {
        yield* Route.default({
          ctx,
          input: {
            name,
            port: publish.map((p) => p.name || p.port.toString()),
            domain: input.domain,
          },
          signal,
          defer,
        })
      } catch (err) {
        console.error(`Failed to route container ${name}:`, err)
        yield `Failed to route container ${name}`
      }
    }
  }

  if (detach) {
    // If detach is enabled, just return without attaching
    yield `Containers ${name} is running. Detached successfully.`
    return
  } else if (pod?.status?.phase === 'Running') {
    // Logs
    // Attach to the pod if interactive or terminal mode is enabled
    yield* attach({
      ctx,
      input: {
        name,
        interactive,
        terminal,
      },
      signal,
      defer,
    })
  } else {
    yield* logs({
      ctx,
      input: {
        name,
        follow: true,
        timestamps: false,
      },
      signal,
      defer,
    })
  }
}

// async function waitPodEvent(ctx: ServerContext, name: string, eventType: WatchEvent<any, any>['type']): Promise<void> {
//   // TODO: Add timeout to prevent indefinite waiting and potential DoS
//   // TODO: Add rate limiting for watch operations
//   // TODO: Implement exponential backoff for failed watch attempts
//   // TODO: Add circuit breaker pattern for resilience

//   const podWatcher = await ctx.kube.client['karmada'].CoreV1.namespace(ctx.kube.namespace).watchPodList({
//     labelSelector: `ctnr.io/name=${name}`,
//     abortSignal: signal,
//   })
//   const reader = podWatcher.getReader()
//   while (true) {
//     const { done, value } = await reader.read()
//     const pod = value?.object as Pod
//     if (value?.type === eventType && pod?.metadata?.name === name) {
//       console.debug(`Pod ${name} event: ${eventType}`)
//       break
//     }
//     if (done) {
//       return
//     }
//   }
// }

// async function waitForPod(
//   ctx: ServerContext,
//   name: string,
//   predicate: (pod: Pod) => boolean | Promise<boolean>,
// ): Promise<Pod> {
//   const podWatcher = await ctx.kube.client['karmada'].CoreV1.namespace(ctx.kube.namespace).watchPodList({
//     labelSelector: `ctnr.io/name=${name}`,
//     abortSignal: signal,
//   })
//   const reader = podWatcher.getReader()
//   while (true) {
//     const { done, value } = await reader.read()
//     const pod = value?.object as Pod
//     if (await predicate(pod)) {
//       return pod
//     }
//     if (done) {
//       return pod
//     }
//   }
// }

async function waitForDeployment({ ctx, name, predicate, signal }: {
  ctx: ServerContext
  name: string
  predicate: (deployment: Deployment) => boolean | Promise<boolean>
  signal: AbortSignal
}): Promise<Deployment> {
  const deploymentWatcher = await ctx.kube.client['karmada'].AppsV1.namespace(ctx.kube.namespace).watchDeploymentList({
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

async function waitForDeploymentDeletion(
  { ctx, name, signal }: { ctx: ServerContext; name: string; signal: AbortSignal },
): Promise<void> {
  const deploymentWatcher = await ctx.kube.client['karmada'].AppsV1.namespace(ctx.kube.namespace).watchDeploymentList({
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
