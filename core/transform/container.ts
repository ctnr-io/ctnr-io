/**
 * Container Transformer
 * Converts Kubernetes Deployment resources to Container DTOs
 * and Container input to Deployment resources
 */
import type { Deployment } from '@cloudydeno/kubernetes-apis/apps/v1'
import { toQuantity } from '@cloudydeno/kubernetes-apis/common.ts'
import type { Pod } from '@cloudydeno/kubernetes-apis/core/v1'
import type { Container, ContainerInstance, ContainerPort, ContainerReplicas, ContainerStatus, ContainerSummary } from 'core/schemas/compute/container.ts'
import type { PodMetrics } from 'infra/kubernetes/types/metrics.ts'
import type { HTTPRoute } from 'infra/kubernetes/types/gateway.ts'
import type { IngressRoute } from 'infra/kubernetes/types/traefik.ts'
import { normalizeQuantity } from './resources.ts'

/**
 * Input for creating a container (deployment)
 */
export interface ContainerInput {
  name: string
  namespace: string
  image: string
  env?: string[]
  publish?: Array<{ name: string; port: number; protocol?: string }>
  volume?: Array<{ name: string; mountPath: string; size: string }>
  interactive?: boolean
  terminal?: boolean
  command?: string
  replicas?: number | string
  cpu?: string
  memory?: string
  ephemeralStorage?: string
  restart?: 'always' | 'on-failure' | 'never'
}

/**
 * Options for transforming a deployment to a container
 */
export interface TransformContainerOptions {
  pods?: Pod[]
  metrics?: PodMetrics[]
  routes?: {
    http: HTTPRoute[]
    ingress: IngressRoute[]
  }
}

/**
 * Transform a Kubernetes Deployment to a ContainerSummary DTO (lightweight)
 */
export function deploymentToContainerSummary(deployment: Deployment): ContainerSummary {
  const metadata = deployment.metadata ?? {}
  const spec = deployment.spec
  const status = deployment.status ?? {}
  const container = spec?.template?.spec?.containers?.[0]

  // Extract resource info
  const resources = container?.resources ?? {}
  const limits = resources.limits ?? {}
  const requests = resources.requests ?? {}

  const cpuLimit = normalizeQuantity(limits.cpu) || normalizeQuantity(requests.cpu) || '250m'
  const memoryLimit = normalizeQuantity(limits.memory) || normalizeQuantity(requests.memory) || '512Mi'

  return {
    name: metadata.name ?? '',
    image: extractImageName(container?.image ?? ''),
    status: mapDeploymentStatus(status),
    createdAt: new Date(metadata.creationTimestamp ?? Date.now()),
    cpu: cpuLimit,
    memory: memoryLimit,
    replicas: {
      current: status.readyReplicas ?? 0,
      desired: spec?.replicas ?? 1,
    },
  }
}

/**
 * Transform a Kubernetes Deployment to a Container DTO
 */
export function deploymentToContainer(
  deployment: Deployment,
  options: TransformContainerOptions = {},
): Container {
  const metadata = deployment.metadata ?? {}
  const spec = deployment.spec
  const status = deployment.status ?? {}
  const podSpec = spec?.template?.spec
  const container = podSpec?.containers?.[0]
  const labels = metadata.labels ?? {}
  const annotations = metadata.annotations ?? {}

  // Extract resource info
  const resources = container?.resources ?? {}
  const limits = resources.limits ?? {}
  const requests = resources.requests ?? {}

  // Calculate resource values
  const cpuLimit = normalizeQuantity(limits.cpu) || normalizeQuantity(requests.cpu) || '250m'
  const memoryLimit = normalizeQuantity(limits.memory) || normalizeQuantity(requests.memory) || '512Mi'
  const storageLimit = normalizeQuantity(limits['ephemeral-storage']) ||
    normalizeQuantity(requests['ephemeral-storage']) || '1Gi'

  // Extract replicas info
  const replicas = extractReplicas(deployment, options.pods, options.metrics)

  // Extract routes
  const routes = options.routes
    ? extractRoutesForContainer(metadata.name ?? '', options.routes.http, options.routes.ingress)
    : []

  // Build resources object only if we have values
  const requestsCpu = normalizeQuantity(requests.cpu)
  const requestsMemory = normalizeQuantity(requests.memory)
  const requestsStorage = normalizeQuantity(requests['ephemeral-storage'])
  const limitsCpu = normalizeQuantity(limits.cpu)
  const limitsMemory = normalizeQuantity(limits.memory)
  const limitsStorage = normalizeQuantity(limits['ephemeral-storage'])

  return {
    name: metadata.name ?? '',
    image: extractImageName(container?.image ?? ''),
    tag: extractImageTag(container?.image ?? ''),
    status: mapDeploymentStatus(status),
    createdAt: new Date(metadata.creationTimestamp ?? Date.now()),
    ports: extractPorts(container?.ports as Array<{ name?: string; containerPort?: number; protocol?: string }> ?? []),
    routes,
    cpu: cpuLimit,
    memory: memoryLimit,
    storage: storageLimit,
    resources: {
      requests: (requestsCpu || requestsMemory)
        ? {
          cpu: requestsCpu || '0m',
          memory: requestsMemory || '0Mi',
          storage: requestsStorage || undefined,
        }
        : undefined,
      limits: (limitsCpu || limitsMemory)
        ? {
          cpu: limitsCpu || '0m',
          memory: limitsMemory || '0Mi',
          storage: limitsStorage || undefined,
        }
        : undefined,
    },
    replicas,
    restartPolicy: (podSpec?.restartPolicy as 'Always' | 'OnFailure' | 'Never') ?? 'Always',
    command: container?.command ?? [],
    args: container?.args ?? undefined,
    workingDir: container?.workingDir ?? '',
    environment: extractEnvironment(container?.env as Array<{ name?: string; value?: string }> ?? []),
    volumeMounts: container?.volumeMounts?.map((vm) => ({
      name: vm.name ?? '',
      mountPath: vm.mountPath ?? '',
      readOnly: vm.readOnly ?? false,
    })),
    labels,
    annotations,
  }
}

/**
 * Map Kubernetes Deployment status to ContainerStatus
 */
export function mapDeploymentStatus(status: Deployment['status']): ContainerStatus {
  if (!status) return 'unknown'

  const { replicas = 0, readyReplicas = 0, availableReplicas = 0, unavailableReplicas = 0 } = status

  // Check conditions for more detailed status
  const conditions = status.conditions ?? []
  const progressingCondition = conditions.find((c) => c.type === 'Progressing')
  const availableCondition = conditions.find((c) => c.type === 'Available')

  // Deployment is scaling up
  if (progressingCondition?.reason === 'NewReplicaSetCreated' ||
    progressingCondition?.reason === 'ReplicaSetUpdated') {
    return 'starting'
  }

  // Deployment is scaling down
  if (replicas === 0) {
    return 'stopped'
  }

  // All replicas ready
  if (readyReplicas === replicas && availableReplicas === replicas) {
    return 'running'
  }

  // Some replicas not ready
  if ((unavailableReplicas ?? 0) > 0) {
    return 'pending'
  }

  // Check for errors in conditions
  if (availableCondition?.status === 'False') {
    return 'error'
  }

  return 'pending'
}

/**
 * Extract port mappings from container ports
 */
export function extractPorts(ports: Array<{ name?: string; containerPort?: number; protocol?: string }>): ContainerPort[] {
  return ports.map((port) => ({
    name: port.name,
    number: port.containerPort ?? 0,
    protocol: (port.protocol?.toLowerCase() as 'tcp' | 'udp') ?? 'tcp',
  }))
}

/**
 * Extract replicas information including pod instances
 */
export function extractReplicas(
  deployment: Deployment,
  pods?: Pod[],
  metrics?: PodMetrics[],
): ContainerReplicas {
  const annotations = deployment.metadata?.annotations ?? {}
  const status = deployment.status ?? {}

  const minReplicas = parseInt(annotations['ctnr.io/min-replicas'] ?? '1', 10)
  const maxReplicas = parseInt(annotations['ctnr.io/max-replicas'] ?? '1', 10)
  const currentReplicas = status.readyReplicas ?? status.availableReplicas ?? 0

  // Extract pod instances
  const deploymentName = deployment.metadata?.name ?? ''
  const instances: ContainerInstance[] = []

  if (pods) {
    const deploymentPods = pods.filter((pod) => {
      const ownerRefs = pod.metadata?.ownerReferences ?? []
      const labels = pod.metadata?.labels ?? {}
      // Match by owner reference or by label
      return ownerRefs.some((ref) => ref.name?.startsWith(deploymentName)) ||
        labels['ctnr.io/name'] === deploymentName
    })

    for (const pod of deploymentPods) {
      const podName = pod.metadata?.name ?? ''
      const podMetrics = metrics?.find((m) => m.metadata.name === podName)

      instances.push({
        name: podName,
        status: mapPodStatus(pod),
        createdAt: new Date(pod.metadata?.creationTimestamp ?? Date.now()),
        cpu: podMetrics?.containers?.[0]?.usage?.cpu ?? '0m',
        memory: podMetrics?.containers?.[0]?.usage?.memory ?? '0Mi',
        restarts: pod.status?.containerStatuses?.[0]?.restartCount,
        node: pod.spec?.nodeName ?? undefined,
      })
    }
  }

  return {
    min: minReplicas,
    max: maxReplicas,
    current: currentReplicas,
    instances,
  }
}

/**
 * Map pod status to a simple string
 */
function mapPodStatus(pod: Pod): string {
  const phase = pod.status?.phase ?? 'Unknown'
  const containerStatuses = pod.status?.containerStatuses ?? []

  // Check for container-level issues
  for (const cs of containerStatuses) {
    if (cs.state?.waiting?.reason) {
      return cs.state.waiting.reason
    }
    if (cs.state?.terminated?.reason) {
      return cs.state.terminated.reason
    }
  }

  return phase
}

/**
 * Extract routes that point to this container
 */
export function extractRoutesForContainer(
  containerName: string,
  httpRoutes: HTTPRoute[],
  ingressRoutes: IngressRoute[],
): string[] {
  const routes: string[] = []

  // Check HTTPRoutes
  for (const route of httpRoutes) {
    for (const rule of route.spec.rules ?? []) {
      for (const backend of rule.backendRefs ?? []) {
        if (backend.name === containerName) {
          for (const hostname of route.spec.hostnames ?? []) {
            // Add scheme to route
            if (route.spec.parentRefs?.some((pr) => pr.sectionName === 'websecure')) {
              routes.push(`https://${hostname}`)
            } else {
              routes.push(`http://${hostname}`)
            }
          }
        }
      }
    }
  }

  // Check IngressRoutes
  for (const route of ingressRoutes) {
    for (const r of route.spec.routes ?? []) {
      for (const service of r.services ?? []) {
        if (service.name === containerName) {
          // Extract hostname from match rule
          const hostMatch = r.match?.match(/Host\(`([^`]+)`\)/)
          if (hostMatch?.[1]) {
            if (route.spec.entryPoints?.includes('websecure')) {
              routes.push(`https://${hostMatch[1]}`)
            } else {
              routes.push(`http://${hostMatch[1]}`)
            }
          }
        }
      }
    }
  }

  return [...new Set(routes)] // Remove duplicates
}

/**
 * Extract cluster names from labels
 */
export function extractClusters(labels: Record<string, string>): string[] {
  const clusters: string[] = []

  // Check for Karmada cluster labels
  const clusterLabel = labels['karmada.io/managed'] || labels['propagationpolicy.karmada.io/name']
  if (clusterLabel) {
    // If managed by Karmada, extract cluster info from other labels
    const targetClusters = labels['karmada.io/cluster']
    if (targetClusters) {
      clusters.push(...targetClusters.split(','))
    }
  }

  // Check for ctnr.io cluster label
  const ctnrCluster = labels['ctnr.io/cluster']
  if (ctnrCluster) {
    clusters.push(ctnrCluster)
  }

  return clusters.length > 0 ? clusters : ['karmada']
}

/**
 * Extract environment variables to a record
 */
export function extractEnvironment(envVars: Array<{ name?: string; value?: string }>): Record<string, string> {
  const env: Record<string, string> = {}
  for (const ev of envVars) {
    if (ev.name && ev.value !== undefined) {
      env[ev.name] = ev.value
    }
  }
  return env
}

/**
 * Extract image name without tag
 */
function extractImageName(image: string): string {
  const [name] = image.split(':')
  return name ?? image
}

/**
 * Extract image tag
 */
function extractImageTag(image: string): string | undefined {
  const parts = image.split(':')
  return parts.length > 1 ? parts[1] : undefined
}

/**
 * Transform Container input to a Kubernetes Deployment resource
 */
export function containerInputToDeployment(input: ContainerInput): Deployment {
  const {
    name,
    namespace,
    image,
    env = [],
    publish = [],
    volume = [],
    interactive = false,
    terminal = false,
    command,
    replicas = 1,
    cpu = '250m',
    memory = '256Mi',
    ephemeralStorage = '1Gi',
  } = input

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

  const labels: Record<string, string> = {
    'ctnr.io/name': name,
  }

  const annotations: Record<string, string> = {
    'ctnr.io/min-replicas': minReplicas.toString(),
    'ctnr.io/max-replicas': maxReplicas.toString(),
    'kubernetes.io/ingress-bandwidth': '100M',
    'kubernetes.io/egress-bandwidth': '100M',
  }

  const deploymentResource: Deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name,
      namespace,
      labels,
      annotations,
    },
    spec: {
      replicas: replicaCount,
      selector: {
        matchLabels: {
          'ctnr.io/name': name,
          'ctnr.io/type': 'container',
        },
      },
      template: {
        metadata: {
          labels: {
            'ctnr.io/name': name,
            'ctnr.io/type': 'container',
          },
        },
        spec: {
          restartPolicy: 'Always',
          hostNetwork: false,
          hostPID: false,
          hostIPC: false,
          hostUsers: false,
          automountServiceAccountToken: false,
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
              ports: publish.map((p) => ({
                name: p.name,
                containerPort: Number(p.port),
                protocol: (p.protocol?.toUpperCase() || 'TCP') as 'TCP' | 'UDP',
              })),
              volumeMounts: volume.map((vol) => ({
                name: vol.name,
                mountPath: vol.mountPath,
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
              securityContext: {
                allowPrivilegeEscalation: false,
                privileged: false,
                // When `hostUsers: false`, we can use all capabilities because root in container is isolated as an user namespace on the host.
                // capabilities: {
                //   drop: ['ALL'],
                //   add: [
                //     'CHOWN',
                //     'DAC_OVERRIDE',
                //     'FOWNER',
                //     'FSETID',
                //     'KILL',
                //     'NET_BIND_SERVICE',
                //     'SETGID',
                //     'SETUID',
                //     'AUDIT_WRITE',
                //   ],
                // },
              },
              resources: {
                limits: {
                  cpu: toQuantity(cpu),
                  memory: toQuantity(memory),
                  'ephemeral-storage': toQuantity(ephemeralStorage),
                },
                requests: {
                  cpu: toQuantity(cpu),
                  memory: toQuantity(memory),
                  'ephemeral-storage': toQuantity(ephemeralStorage),
                },
              },
            },
          ],
          volumes: volume.map((vol) => ({
            name: vol.name,
            persistentVolumeClaim: {
              claimName: vol.name,
            },
          })),
          dnsPolicy: 'ClusterFirst',
        },
      },
    },
  }

  return deploymentResource
}
