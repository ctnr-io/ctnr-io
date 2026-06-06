/**
 * Container Transformer
 * Converts Kubernetes Pod resources to Container DTOs
 * and Container input to Pod resources
 */
import { Container, ContainerPort, ContainerState, ContainerStatus, ContainerSummary } from 'core/schemas/compute/container.ts'
import type { PodMetrics } from 'infra/kubernetes/types/metrics.ts'
import type { HTTPRoute } from 'infra/kubernetes/types/gateway.ts'
import type { IngressRoute } from 'infra/kubernetes/types/traefik.ts'
import { normalizeQuantity } from './resources.ts'
import { match, P } from 'ts-pattern'
import { Pod } from 'infra/kubernetes/types/core.ts'

/**
 * Input for creating a container (pod)
 */
export interface ContainerInput {
  name: string
  namespace: string
  image: string
  desiredStatus?: ContainerStatus
  env?: string[]
  publish?: Array<{ name: string; port: number; protocol?: string }>
  volume?: Array<{ name: string; mountPath: string; size: string }>
  interactive?: boolean
  terminal?: boolean
  command?: string[]
  cpu?: string
  memory?: string
  ephemeralStorage?: string
  restart?: 'no' | 'always' | 'on-failure' | 'unless-stopped'
}

/**
 * Options for transforming a pod to a container
 */
export type TransformContainerOptions = {
  metrics?: PodMetrics[]
  routes?: {
    http: HTTPRoute[]
    ingress: IngressRoute[]
  }
}

/**
 * Transform a Kubernetes Pod to a ContainerSummary DTO (lightweight)
 */
export function podToContainerSummary(pod: Pod): ContainerSummary {
  const metadata = pod.metadata ?? {}
  const spec = pod.spec
  const container = spec?.containers?.[0]

  // Extract resource info
  const resources = container?.resources ?? {}
  const limits = resources.limits ?? {}
  const requests = resources.requests ?? {}

  const cpuLimit = normalizeQuantity(limits.cpu) || normalizeQuantity(requests.cpu) || '250m'
  const memoryLimit = normalizeQuantity(limits.memory) || normalizeQuantity(requests.memory) || '512Mi'

  return {
    name: metadata.name ?? '',
    image: extractImageName(container?.image ?? ''),
    status: convertPodToContainerStatus(pod),
    createdAt: new Date(metadata.creationTimestamp ?? Date.now()),
    cpu: cpuLimit,
    memory: memoryLimit,
  }
}

/**
 * Transform a Kubernetes Pod to a Container DTO
 */
export function podToContainer(
  pod: Pod,
  options: TransformContainerOptions = {},
): Container {
  const metadata = pod.metadata ?? {}
  const spec = pod.spec
  const container = spec?.containers?.[0]
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
    status: convertPodToContainerStatus(pod),
    state: extractContainerState(pod),
    createdAt: new Date(metadata.creationTimestamp ?? Date.now()),
    ports: extractPorts(container?.ports as Array<{ name?: string; containerPort?: number; protocol?: string }> ?? []),
    routes,
    terminal: container?.tty ?? false,
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
    restartPolicy: match(spec?.restartPolicy)
      .with('Never', () => 'no' as const)
      .with('OnFailure', () => 'on-failure' as const)
      .with(
        P.union('Always', undefined),
        () => (annotations['ctnr.io/restart-policy'] || 'always') as 'always' | 'unless-stopped',
      )
      .exhaustive(),
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
 * Extract port mappings from container ports
 */
export function extractPorts(
  ports: Array<{ name?: string; containerPort?: number; protocol?: string }>,
): ContainerPort[] {
  return ports.map((port) => ({
    name: port.name,
    number: port.containerPort ?? 0,
    protocol: (port.protocol?.toLowerCase() as 'tcp' | 'udp') ?? 'tcp',
  }))
}

/**
 * Extract container state from Kubernetes pod
 */
export function extractContainerState(pod: Pod): ContainerState {
  const desiredStatus = pod.metadata?.annotations?.['ctnr.io/desired-status'] as ContainerStatus | undefined
  const containerStatuses = pod.status?.containerStatuses ?? []
  const mainContainer = containerStatuses[0]
  const restartPolicy = pod.spec?.restartPolicy
  const restartCount = mainContainer?.restartCount ?? 0

  // Initialize state flags
  let running = false
  let paused = false
  let restarting = false
  let oomKilled = false
  let dead = false
  let exitCode: number | undefined
  let error: string | undefined
  let reason: string | undefined
  let message: string | undefined
  let startedAt: string | undefined
  let finishedAt: string | undefined

  // Determine status (reuse existing logic)
  const status = convertPodToContainerStatus(pod)

  // Extract detailed state from container status
  if (mainContainer) {
    if (mainContainer.state?.waiting) {
      reason = mainContainer.state.waiting.reason ?? undefined
      message = mainContainer.state.waiting.message ?? undefined
      
      // Check if restarting
      if (reason === 'CrashLoopBackOff' || reason === 'RunContainerError' || restartCount > 0) {
        restarting = true
      }
      
      // Set error for failed states
      if (reason && ['CreateContainerError', 'InvalidImageName', 'CreateContainerConfigError', 'ErrImagePull', 'ImagePullBackOff'].includes(reason)) {
        error = message || reason
        if (['CreateContainerError', 'InvalidImageName', 'CreateContainerConfigError'].includes(reason)) {
          dead = true
        }
      }
    }

    if (mainContainer.state?.running) {
      running = true
      startedAt = mainContainer.state.running.startedAt ? 
        (mainContainer.state.running.startedAt instanceof Date ? 
          mainContainer.state.running.startedAt.toISOString() : 
          mainContainer.state.running.startedAt) : undefined
    }

    if (mainContainer.state?.terminated) {
      exitCode = mainContainer.state.terminated.exitCode ?? 0
      reason = mainContainer.state.terminated.reason ?? undefined
      message = mainContainer.state.terminated.message ?? undefined
      startedAt = mainContainer.state.terminated.startedAt ? 
        (mainContainer.state.terminated.startedAt instanceof Date ? 
          mainContainer.state.terminated.startedAt.toISOString() : 
          mainContainer.state.terminated.startedAt) : undefined
      finishedAt = mainContainer.state.terminated.finishedAt ? 
        (mainContainer.state.terminated.finishedAt instanceof Date ? 
          mainContainer.state.terminated.finishedAt.toISOString() : 
          mainContainer.state.terminated.finishedAt) : undefined
      
      // Check for OOMKilled
      if (reason === 'OOMKilled') {
        oomKilled = true
        dead = true
        error = 'Container killed due to out of memory'
      }
      
      // Check if container will restart
      const willRestart = restartPolicy === 'Always' ||
        (restartPolicy === 'OnFailure' && exitCode !== 0)
      
      if (willRestart && restartCount > 0) {
        restarting = true
      } else if (exitCode !== 0 && !oomKilled) {
        dead = true
        error = message || reason || `Container exited with code ${exitCode}`
      }
    }
  }

  // Handle paused state
  if (desiredStatus === 'paused' && pod.spec?.nodeSelector?.['hack.ctnr.io'] === 'paused') {
    paused = true
    running = false
  }

  // Handle removing state
  if (desiredStatus === 'removing') {
    dead = true
  }

  return {
    status,
    running,
    paused,
    restarting,
    oomKilled,
    dead,
    exitCode,
    error,
    startedAt,
    finishedAt,
    reason,
    message,
  }
}

/**
 * Convert pod status to a container status
 * 
 * Priority hierarchy (highest to lowest):
 * 1. Check for removal intent (desiredStatus annotation)
 * 2. Container actual state (waiting/running/terminated)
 * 3. Paused state (desired status + node selector)
 * 4. Desired status for newly created containers
 * 5. Pod phase fallback
 */
export function convertPodToContainerStatus(pod: Pod): ContainerStatus {
  const desiredStatus = pod.metadata?.annotations?.['ctnr.io/desired-status'] as ContainerStatus | undefined
  const podPhase = pod.status?.phase
  const containerStatuses = pod.status?.containerStatuses ?? []
  const mainContainer = containerStatuses[0]
  const restartPolicy = pod.spec?.restartPolicy
  const restartCount = mainContainer?.restartCount ?? 0

  // Priority 1: Check if container is being removed
  if (desiredStatus === 'removing') {
    return 'removing'
  }

  // Priority 2: Check actual container state (most reliable indicator)
  if (mainContainer) {
    // Container is waiting (startup, image pull, crash loop, etc.)
    if (mainContainer.state?.waiting) {
      const reason = mainContainer.state.waiting.reason
      
      // Check if container has restarted before - if so, it's restarting
      if (restartCount > 0) {
        return 'restarting'
      }
      
      // Map waiting reasons to statuses based on recoverability
      return match(reason)
        // Restarting: Container crashed and restart policy will retry
        .with('CrashLoopBackOff', 'RunContainerError', () => 'restarting' as const)
        
        // Dead: Unrecoverable errors that prevent container from starting
        .with('CreateContainerError', 'InvalidImageName', 'CreateContainerConfigError', () => 'dead' as const)
        
        // Created: Normal startup states or recoverable errors
        .with(
          'ContainerCreating',
          'PodInitializing',
          'ImagePullBackOff',
          'ErrImagePull',
          'ImageInspectError',
          P.nullish,
          () => 'created' as const,
        )
        
        // Default to created for unknown waiting reasons
        .otherwise(() => 'created' as const)
    }

    // Container is actively running
    if (mainContainer.state?.running) {
      return 'running'
    }

    // Container has terminated
    if (mainContainer.state?.terminated) {
      const exitCode = mainContainer.state.terminated.exitCode ?? 0
      const reason = mainContainer.state.terminated.reason

      // Check for OOMKilled
      if (reason === 'OOMKilled') {
        return 'dead'
      }

      // Check if container is restarting (terminated but will restart)
      // Kubernetes only restarts if restartPolicy allows and within backoff limits
      const willRestart = restartPolicy === 'Always' ||
        (restartPolicy === 'OnFailure' && exitCode !== 0)

      // If container has restarted before and will restart again, it's restarting
      if (willRestart && restartCount > 0) {
        return 'restarting'
      }

      // Otherwise, map based on exit code
      return exitCode === 0 ? 'exited' : 'dead'
    }
  }

  // Priority 3: Check if intentionally paused (after checking actual state)
  // Paused containers have desiredStatus='paused' AND the special nodeSelector
  // We check this after container state to handle start-in-progress scenarios
  if (desiredStatus === 'paused' && pod.spec?.nodeSelector?.['hack.ctnr.io'] === 'paused') {
    // Extra safety: if container is actually running, respect actual state
    // (this handles the case where start was called but pod hasn't updated yet)
    if (mainContainer?.state?.running) {
      return 'running'
    }
    return 'paused'
  }

  // Priority 4: Check desiredStatus for newly created containers (no container state yet)
  if (desiredStatus === 'created' && !mainContainer) {
    return 'created'
  }

  // Priority 5: Fallback to pod phase when no container state is available
  return match(podPhase)
    .with('Pending', () => 'created' as const)
    .with('Running', () => 'running' as const)
    .with('Succeeded', () => 'exited' as const)
    .with('Failed', 'Unknown', () => 'dead' as const)
    .otherwise(() => 'created' as const)
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
 * Transform Container input to a Kubernetes Pod resource
 */
export function containerInputToPod(input: ContainerInput): Pod {
  const {
    name,
    namespace,
    desiredStatus = 'created',
    image,
    env = [],
    publish = [],
    volume = [],
    interactive = false,
    terminal = false,
    command,
    cpu = '250m',
    memory = '256Mi',
    ephemeralStorage = '1Gi',
  } = input

  const labels: Record<string, string> = {
    'ctnr.io/name': name,
    'ctnr.io/type': 'container',
  }

  const annotations: Record<string, string> = {
    'ctnr.io/desired-status': desiredStatus,
    'ctnr.io/restart-policy': input.restart ?? 'no',
    'kubernetes.io/ingress-bandwidth': '100M',
    'kubernetes.io/egress-bandwidth': '100M',
  }
  const restartPolicy = match(input.restart)
    .with(P.union('no', undefined), () => 'Never' as const)
    .with(P.union('always', 'unless-stopped'), () => 'Always' as const)
    .with('on-failure', () => 'OnFailure' as const)
    .exhaustive()

  const podResource: Pod = {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: {
      name,
      namespace,
      labels,
      annotations,
    },
    spec: {
      restartPolicy,
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
          command,
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
              cpu: cpu,
              memory: memory,
              'ephemeral-storage': ephemeralStorage,
            },
            requests: {
              cpu: cpu,
              memory: memory,
              'ephemeral-storage': ephemeralStorage,
            },
          },
        },
      ],
      nodeSelector: desiredStatus === 'paused'
        ? {
          'hack.ctnr.io': 'paused',
        }
        : {},
      volumes: volume.map((vol) => ({
        name: vol.name,
        persistentVolumeClaim: {
          claimName: vol.name,
        },
      })),
      dnsPolicy: 'ClusterFirst',
    },
  }

  console.log({
    tty: podResource.spec?.containers[0].tty,
    stdin: podResource.spec?.containers[0].stdin,
    command: podResource.spec?.containers[0].command,
  })

  return podResource
}
