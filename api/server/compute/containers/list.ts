import { z } from 'zod'
import { ServerContext } from 'ctx/mod.ts'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import * as YAML from '@std/yaml'
import { Deployment } from '@cloudydeno/kubernetes-apis/apps/v1'

export const Meta = {
  aliases: {
    options: {
      output: 'o',
    },
  },
}

export const Input = z.object({
  output: z.enum(['wide', 'name', 'json', 'yaml', 'raw']).optional(),
  name: z.string().optional(), // Filter by specific container name
  cluster: z.enum(['eu', 'eu-0', 'eu-1', 'eu-2']).optional(), // Select specific cluster
  fields: z.array(z.enum([
    'basic', // id, name, image, status, createdAt
    'resources', // cpu, memory, ports
    'replicas', // replicas with instances
    'routes', // routes
    'clusters', // clusters
    'config', // restartPolicy, command, workingDir, environment, volumes
    'metrics', // real-time metrics (expensive)
    'all', // all fields (default behavior)
  ])).optional(),
})

export type Input = z.infer<typeof Input>

export type Container = {
  name: string
  image: any
  status: string
  createdAt: Date
  ports: string[]
  cpu: string
  memory: string
  storage: string
  replicas: {
    max: number
    min: number
    current: number
    instances: {
      name: string
      status: string
      createdAt: Date
      cpu: string
      memory: string
    }[]
  }
  routes: string[]
  clusters: string[]
  restartPolicy: string
  command: string[]
  workingDir: string
  environment: Record<string, string>
  volumes: string[]
}

type Output<Type extends 'raw' | 'json' | 'yaml' | 'name' | 'wide'> = {
  'raw': Container[]
  'json': string
  'yaml': string
  'name': string
  'wide': void
}[Type]

export default async function* (
  { ctx, input, signal }: ServerRequest<Input>,
): ServerResponse<Output<NonNullable<typeof input['output']>>> {
  const { output = 'raw', name, cluster = 'eu', fields = ['basic'] } = input

  // Determine which fields to fetch based on input - be very specific
  const requestedFields = new Set(fields)
  const fetchAll = requestedFields.has('all')

  // Optimize field detection - only fetch what's absolutely needed
  const needsRealTimeMetrics = requestedFields.has('metrics')
  const needsResourceInfo = fetchAll || requestedFields.has('resources')
  const needsReplicaInstances = fetchAll || requestedFields.has('replicas')
  const needsRoutes = fetchAll || requestedFields.has('routes')
  const needsClusters = fetchAll || requestedFields.has('clusters')
  const needsConfig = fetchAll || requestedFields.has('config')

  // Use the specified cluster or default to 'eu'
  const kubeClient = ctx.kube.client[cluster]

  // Build label selector - if name is provided, filter by specific name
  let labelSelector = 'ctnr.io/name'
  if (name) {
    labelSelector = `ctnr.io/name=${name}`
  }

  // Always fetch deployments first (this is the core data)
  const deployments = await kubeClient.AppsV1.namespace(ctx.kube.namespace).getDeploymentList({
    labelSelector,
    abortSignal: signal,
  })

  // Early return for simple cases (name-only queries, basic info)
  if (output === 'name') {
    return deployments.items.map((deployment) => deployment.metadata?.name || '').join('\n')
  }

  // Parallel fetch expensive operations only when needed
  const fetchPromises: Promise<any>[] = []
  let promiseIndex = 0
  let podMetricsIndex = -1
  let allPodsIndex = -1
  let routesIndex = -1

  // Fetch metrics only if real-time metrics are explicitly requested
  if (needsRealTimeMetrics || (needsResourceInfo && needsRealTimeMetrics)) {
    podMetricsIndex = promiseIndex++
    fetchPromises.push(fetchPodMetricsOptimized(ctx, cluster, signal))
  }

  // Fetch pods only if replica instances are needed
  if (needsReplicaInstances) {
    allPodsIndex = promiseIndex++
    fetchPromises.push(fetchAllPodsOptimized(ctx, cluster, signal))
  }

  // Fetch routes only if routes are needed
  if (needsRoutes) {
    routesIndex = promiseIndex++
    fetchPromises.push(fetchRoutesOptimized(kubeClient, ctx.kube.namespace))
  }

  // Wait for all parallel operations to complete
  const results = await Promise.allSettled(fetchPromises)

  // Extract results with fallbacks
  const podMetrics = podMetricsIndex >= 0 && results[podMetricsIndex]?.status === 'fulfilled'
    ? (results[podMetricsIndex] as PromiseFulfilledResult<any>).value
    : []
  const allPods = allPodsIndex >= 0 && results[allPodsIndex]?.status === 'fulfilled'
    ? (results[allPodsIndex] as PromiseFulfilledResult<any>).value
    : []
  const routes = routesIndex >= 0 && results[routesIndex]?.status === 'fulfilled'
    ? (results[routesIndex] as PromiseFulfilledResult<any>).value
    : { httpRoutes: [], ingressRoutes: [] }

  // Transform deployments to container data with maximum efficiency
  const containers = deployments.items.map((deployment) => {
    const labels = deployment.metadata?.labels || {}
    const spec = deployment.spec || {}
    const status = deployment.status || {}
    const container = deployment.spec?.template?.spec?.containers?.[0]

    // Build container object with only requested fields - avoid unnecessary processing
    const containerData: Partial<Container> = {}

    // Basic fields (always included for core functionality)
    containerData.name = deployment.metadata?.name || ''
    containerData.image = container?.image || ''
    containerData.status = mapDeploymentStatusToContainerStatus(status)
    containerData.createdAt = new Date(deployment.metadata?.creationTimestamp || '')

    // Resource fields - only if requested
    if (needsResourceInfo) {
      containerData.ports = extractPortMappingsFromContainer(container?.ports ?? [])
      const resources = needsRealTimeMetrics && podMetrics.length > 0
        ? extractResourceUsageFromMetrics(deployment, podMetrics)
        : extractResourceUsageFromDeployment(deployment)
      containerData.cpu = resources.cpu
      containerData.memory = resources.memory
      containerData.storage = resources.storage
    }

    // Replica fields - only if requested
    if (needsReplicaInstances) {
      containerData.replicas = extractReplicaInfoWithInstances(deployment, allPods, podMetrics)
    }

    // Routes fields - only if requested
    if (needsRoutes && routes) {
      containerData.routes = extractRoutesForContainer(
        deployment.metadata?.name || '',
        routes.httpRoutes,
        routes.ingressRoutes,
      )
    }

    // Clusters fields - only if requested
    if (needsClusters) {
      containerData.clusters = extractClustersFromLabels(labels)
    }

    // Config fields - only if requested
    if (needsConfig) {
      containerData.restartPolicy = (spec as any).template?.spec?.restartPolicy || 'Always'
      containerData.command = container?.command || []
      containerData.workingDir = container?.workingDir || '/'
      containerData.environment = extractEnvironmentVariables(container?.env || [])
      containerData.volumes = extractVolumeMounts(container?.volumeMounts || [])
    }

    // Calculate cost based on CPU, memory, and current replicas
    const cpu = containerData.cpu || '100m'
    const memory = containerData.memory || '128Mi'
    const storage = containerData.storage || '1Gi'

    // Return with defaults for missing fields to maintain type compatibility
    return {
      name: containerData.name!,
      image: containerData.image!,
      status: containerData.status!,
      createdAt: containerData.createdAt!,
      ports: containerData.ports || [],
      cpu: cpu,
      memory: memory,
      storage: storage,
      replicas: containerData.replicas || { max: 0, min: 0, current: 0, instances: [] },
      routes: containerData.routes || [],
      clusters: containerData.clusters || [],
      restartPolicy: containerData.restartPolicy || 'Always',
      command: containerData.command || [],
      workingDir: containerData.workingDir || '/',
      environment: containerData.environment || {},
      volumes: containerData.volumes || [],
    }
  })

  switch (output) {
    case 'raw':
      return containers

    case 'json':
      return JSON.stringify(containers, null, 2)

    case 'yaml':
      return YAML.stringify(containers)

    case 'wide':
    default:
      // Header - Enhanced format with replica info
      yield 'NAME'.padEnd(26) +
        'IMAGE'.padEnd(25) +
        'STATUS'.padEnd(15) +
        'REPLICAS'.padEnd(12) +
        'CPU'.padEnd(8) +
        'MEMORY'.padEnd(10) +
        'AGE'.padEnd(12) +
        'PORTS'.padEnd(20)

      // Container rows
      for (const container of containers) {
        const name = container.name.padEnd(26)
        const image = container.image.padEnd(25)
        const status = container.status.padEnd(15)
        const replicas = `${container.replicas.current}`.padEnd(12)
        const cpu = (container.cpu || '').padEnd(8)
        const memory = (container.memory || '').padEnd(10)
        const age = formatAge(container.createdAt).padEnd(12)
        const ports = (container.ports.join(', ') || '').padEnd(20)

        yield name + image + status + replicas + cpu + memory + age + ports
      }
      return
  }
}

function mapDeploymentStatusToContainerStatus(status: any): string {
  if (!status) return 'Unknown'

  const replicas = status.replicas || 0
  const readyReplicas = status.readyReplicas || 0
  const availableReplicas = status.availableReplicas || 0

  if (replicas === 0) return 'stopped'
  if (readyReplicas === replicas && availableReplicas === replicas) return 'running'
  if (readyReplicas > 0) return 'running'
  // Check for image missing or pull errors in conditions
  return 'restarting'
}

function extractPortMappingsFromContainer(ports?: any[]): string[] {
  if (!ports || ports.length === 0) return []

  return ports
    .map((port) => {
      const protocol = port.protocol?.toLowerCase() || 'tcp'
      const portNumber = port.containerPort
      const portName = port.name

      if (portName) {
        return `${portName}:${portNumber}/${protocol}`
      } else {
        return `${portNumber}/${protocol}`
      }
    })
}

function extractReplicaInfoWithInstances(
  deployment: any,
  allPods: any[],
  podMetrics: any[],
): { max: number; min: number; current: number; instances: any[] } {
  const spec = deployment.spec || {}
  const status = deployment.status || {}
  const labels = deployment.metadata?.labels || {}
  const annotations = deployment.metadata?.annotations || {}
  const deploymentName = deployment.metadata?.name

  // Get replica counts from deployment spec and status
  const desired = spec.replicas || 1
  const current = status.readyReplicas || 0

  // Get scaling limits from annotations or use defaults based on desired
  const maxReplicas = parseInt(
    annotations['ctnr.io/max-replicas'] || labels['ctnr.io/max-replicas'] || (desired * 2).toString(),
  )
  const minReplicas = parseInt(
    annotations['ctnr.io/min-replicas'] || labels['ctnr.io/min-replicas'] ||
      Math.max(1, Math.floor(desired / 2)).toString(),
  )

  // Find pods that belong to this deployment
  const deploymentPods = allPods.filter((pod) => {
    const podLabels = pod.metadata?.labels || {}
    return podLabels['ctnr.io/name'] === deploymentName
  })

  // Create instances array with detailed information
  const instances = deploymentPods.map((pod) => {
    const podName = pod.metadata?.name || ''
    const podStatus = pod.status?.phase || 'Unknown'
    const createdAt = pod.metadata?.creationTimestamp || ''

    // Find metrics for this specific pod
    const podMetric = podMetrics.find((metric) => metric.metadata?.name === podName)
    let cpu = '0m'
    let memory = '0Mi'

    if (podMetric && podMetric.containers) {
      let totalCpuNano = 0
      let totalMemoryBytes = 0

      for (const container of podMetric.containers) {
        if (container.usage) {
          // Parse CPU
          const cpuUsage = container.usage.cpu || '0'
          if (cpuUsage.endsWith('n')) {
            totalCpuNano += parseInt(cpuUsage.slice(0, -1))
          } else if (cpuUsage.endsWith('m')) {
            totalCpuNano += parseInt(cpuUsage.slice(0, -1)) * 1000000
          } else {
            totalCpuNano += parseInt(cpuUsage) * 1000000000
          }

          // Parse Memory
          const memoryUsage = container.usage.memory || '0'
          if (memoryUsage.endsWith('Ki')) {
            totalMemoryBytes += parseInt(memoryUsage.slice(0, -2)) * 1024
          } else if (memoryUsage.endsWith('Mi')) {
            totalMemoryBytes += parseInt(memoryUsage.slice(0, -2)) * 1024 * 1024
          } else if (memoryUsage.endsWith('Gi')) {
            totalMemoryBytes += parseInt(memoryUsage.slice(0, -2)) * 1024 * 1024 * 1024
          } else {
            totalMemoryBytes += parseInt(memoryUsage)
          }
        }
      }

      cpu = `${Math.round(totalCpuNano / 1000000)}m`
      memory = `${Math.round(totalMemoryBytes / (1024 * 1024))}Mi`
    }

    return {
      name: podName,
      status: podStatus.toLowerCase(),
      created: createdAt,
      cpu: cpu,
      memory: memory,
    }
  })

  return {
    max: maxReplicas,
    min: minReplicas,
    current: current,
    instances: instances,
  }
}

function extractResourceUsageFromMetrics(
  deployment: Deployment,
  podMetrics: any[],
): { cpu: string; memory: string; storage: string } {
  const deploymentName = deployment.metadata?.name

  // Find pods that belong to this deployment
  const deploymentPods = podMetrics.filter((podMetric) => {
    const labels = podMetric.metadata?.labels || {}
    return labels['ctnr.io/name'] === deploymentName
  })

  if (deploymentPods.length === 0) {
    // Fallback to resource limits/requests if no metrics available
    return extractResourceUsageFromDeployment(deployment)
  }

  // Aggregate CPU and memory usage across all pods for this deployment
  let totalCpuNano = 0
  let totalMemoryBytes = 0
  let totalStorageGB = 0
  let podCount = 0

  for (const podMetric of deploymentPods) {
    const containers = podMetric.containers || []
    for (const container of containers) {
      if (container.usage) {
        // Parse CPU (format: "123n" for nanocores or "123m" for millicores)
        const cpuUsage = container.usage.cpu || '0'
        if (cpuUsage.endsWith('n')) {
          totalCpuNano += parseInt(cpuUsage.slice(0, -1))
        } else if (cpuUsage.endsWith('m')) {
          totalCpuNano += parseInt(cpuUsage.slice(0, -1)) * 1000000 // Convert millicores to nanocores
        } else {
          totalCpuNano += parseInt(cpuUsage) * 1000000000 // Convert cores to nanocores
        }

        // Parse Memory (format: "123Ki", "123Mi", "123Gi", etc.)
        const memoryUsage = container.usage.memory || '0'
        if (memoryUsage.endsWith('Ki')) {
          totalMemoryBytes += parseInt(memoryUsage.slice(0, -2)) * 1024
        } else if (memoryUsage.endsWith('Mi')) {
          totalMemoryBytes += parseInt(memoryUsage.slice(0, -2)) * 1024 * 1024
        } else if (memoryUsage.endsWith('Gi')) {
          totalMemoryBytes += parseInt(memoryUsage.slice(0, -2)) * 1024 * 1024 * 1024
        } else {
          totalMemoryBytes += parseInt(memoryUsage)
        }

        // Parse Storage (format: "123Gi", etc.)
        const storageUsage =
          deployment.spec?.template?.spec?.containers?.[0]?.resources?.limits?.['ephemeral-storage'].serialize() || '0'
        if (storageUsage.endsWith('Gi')) {
          totalStorageGB += parseInt(storageUsage.slice(0, -2))
        } else {
          totalStorageGB += parseInt(storageUsage)
        }

        podCount++
      }
    }
  }

  // Convert back to readable format
  const cpuMillicores = Math.round(totalCpuNano / 1000000)
  const memoryMB = Math.round(totalMemoryBytes / (1024 * 1024))
  const storageGB = Math.round(totalStorageGB)

  return {
    cpu: `${cpuMillicores}m`,
    memory: `${memoryMB}Mi`,
    storage: `${storageGB}Gi`,
  }
}

function extractResourceUsageFromDeployment(deployment: Deployment): { cpu: string; memory: string; storage: string } {
  // Extract resource usage from annotations or calculate from container resources
  const container = deployment.spec?.template?.spec?.containers?.[0]
  const resources = container?.resources

  // Try annotations first, then fall back to resource requests/limits
  let cpu
  let memory
  let storage

  if (!cpu && resources?.requests?.cpu) {
    cpu = normalizeKubernetesResourceValue(resources.requests.cpu)
  } else if (!cpu && resources?.limits?.cpu) {
    cpu = normalizeKubernetesResourceValue(resources.limits.cpu)
  } else if (!cpu) {
    cpu = '100m'
  }

  if (!memory && resources?.requests?.memory) {
    memory = normalizeKubernetesResourceValue(resources.requests.memory)
  } else if (!memory && resources?.limits?.memory) {
    memory = normalizeKubernetesResourceValue(resources.limits.memory)
  } else if (!memory) {
    memory = '128Mi'
  }

  if (!storage && resources?.requests?.['ephemeral-storage']) {
    storage = normalizeKubernetesResourceValue(resources.requests['ephemeral-storage'])
  } else if (!storage && resources?.limits?.['ephemeral-storage']) {
    storage = normalizeKubernetesResourceValue(resources.limits['ephemeral-storage'])
  } else if (!storage) {
    storage = '1Gi'
  }

  return {
    cpu: String(cpu || '100m'),
    memory: String(memory || '128Mi'),
    storage: String(storage || '1Gi'),
  }
}

function normalizeKubernetesResourceValue(value: any): string {
  // Handle different formats that Kubernetes API can return
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'object' && value !== null) {
    // Handle structured format like {"number": 250, "suffix": "m"}
    if (typeof value.number !== 'undefined' && typeof value.suffix !== 'undefined') {
      return `${value.number}${value.suffix}`
    }

    // Handle other object formats by converting to JSON (fallback)
    return JSON.stringify(value)
  }

  // Handle numbers or other primitive types
  return String(value)
}

function extractRoutesForContainer(containerName: string, httpRoutes: any[], ingressRoutes: any[]): string[] {
  const routes: string[] = []

  // Extract routes from HTTPRoutes
  for (const httpRoute of httpRoutes) {
    const labels = httpRoute.metadata?.labels || {}
    if (labels['ctnr.io/owner-id'] && httpRoute.metadata?.name === containerName) {
      const hostnames = httpRoute.spec?.hostnames || []
      for (const hostname of hostnames) {
        routes.push(`https://${hostname}`)
      }
    }
  }

  // Extract routes from IngressRoutes (Traefik)
  for (const ingressRoute of ingressRoutes) {
    const labels = ingressRoute.metadata?.labels || {}
    if (labels['ctnr.io/owner-id'] && ingressRoute.metadata?.name === containerName) {
      const routeRules = ingressRoute.spec?.routes || []
      for (const rule of routeRules) {
        // Extract hostname from match rule (e.g., "Host(`example.com`)")
        const match = rule.match || ''
        const hostMatch = match.match(/Host\(`([^`]+)`\)/)
        if (hostMatch && hostMatch[1]) {
          const protocol = ingressRoute.spec?.tls ? 'https' : 'http'
          routes.push(`${protocol}://${hostMatch[1]}`)
        }
      }
    }
  }

  return routes
}

function extractClustersFromLabels(labels: any): string[] {
  const clusters: string[] = []

  // Look for labels with pattern cluster.ctnr.io/<cluster-name>=true
  for (const [key, value] of Object.entries(labels)) {
    if (key.startsWith('cluster.ctnr.io/') && value === 'true') {
      const clusterName = key.replace('cluster.ctnr.io/', '')
      if (clusterName) {
        clusters.push(clusterName)
      }
    }
  }

  return clusters
}

function extractEnvironmentVariables(envVars: any[]): Record<string, string> {
  const environment: Record<string, string> = {}

  if (!envVars || envVars.length === 0) return environment

  for (const envVar of envVars) {
    if (envVar.name && envVar.value !== undefined) {
      environment[envVar.name] = envVar.value
    } else if (envVar.name && envVar.valueFrom) {
      // Handle valueFrom cases (secrets, configMaps, etc.)
      if (envVar.valueFrom.secretKeyRef) {
        environment[envVar.name] = `<secret:${envVar.valueFrom.secretKeyRef.name}/${envVar.valueFrom.secretKeyRef.key}>`
      } else if (envVar.valueFrom.configMapKeyRef) {
        environment[envVar.name] =
          `<configMap:${envVar.valueFrom.configMapKeyRef.name}/${envVar.valueFrom.configMapKeyRef.key}>`
      } else if (envVar.valueFrom.fieldRef) {
        environment[envVar.name] = `<field:${envVar.valueFrom.fieldRef.fieldPath}>`
      } else if (envVar.valueFrom.resourceFieldRef) {
        environment[envVar.name] = `<resource:${envVar.valueFrom.resourceFieldRef.resource}>`
      } else {
        environment[envVar.name] = '<valueFrom>'
      }
    }
  }

  return environment
}

function extractVolumeMounts(volumeMounts: any[]): string[] {
  const volumes: string[] = []

  if (!volumeMounts || volumeMounts.length === 0) return volumes

  for (const mount of volumeMounts) {
    if (mount.name && mount.mountPath) {
      const readOnly = mount.readOnly ? ':ro' : ''
      volumes.push(`${mount.name}:${mount.mountPath}${readOnly}`)
    }
  }

  return volumes
}

function formatAge(createdAt?: Date): string {
  if (!createdAt) return '<unknown>'

  const age = new Date(createdAt)
  const now = new Date()
  const diffMs = now.getTime() - age.getTime()

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}

// Optimized helper functions for parallel data fetching
async function fetchPodMetricsOptimized(
  ctx: ServerContext,
  cluster: 'eu' | 'eu-0' | 'eu-1' | 'eu-2',
  signal: AbortSignal,
): Promise<any[]> {
  const podMetrics: any[] = []

  if (cluster === 'eu') {
    // For abstract 'eu' cluster, fetch metrics from all concrete clusters in parallel
    const concreteClusters = ['eu-0', 'eu-1', 'eu-2'] as const
    const promises = concreteClusters.map(async (concreteCluster) => {
      try {
        const clusterClient = ctx.kube.client[concreteCluster as keyof typeof ctx.kube.client]
        const metricsResponse = await clusterClient.MetricsV1Beta1(ctx.kube.namespace).getPodsListMetrics({
          abortSignal: signal,
        })
        const clusterMetrics = metricsResponse.items || []

        // Add cluster information to each metric for identification
        return clusterMetrics.map((metric: any) => ({
          ...metric,
          _cluster: concreteCluster,
        }))
      } catch (error) {
        console.warn(`Failed to fetch pod metrics from cluster ${concreteCluster}:`, error)
        return []
      }
    })

    const results = await Promise.all(promises)
    results.forEach((clusterMetrics) => podMetrics.push(...clusterMetrics))
  } else {
    // For specific clusters, fetch metrics only from that cluster
    try {
      const clusterClient = ctx.kube.client[cluster]
      const metricsResponse = await clusterClient.MetricsV1Beta1(ctx.kube.namespace).getPodsListMetrics({
        abortSignal: signal,
      })
      podMetrics.push(...(metricsResponse.items || []))
    } catch (error) {
      console.warn(`Failed to fetch pod metrics from cluster ${cluster}:`, error)
    }
  }

  return podMetrics
}

async function fetchAllPodsOptimized(
  ctx: ServerContext,
  cluster: 'eu' | 'eu-0' | 'eu-1' | 'eu-2',
  signal: AbortSignal,
): Promise<any[]> {
  const allPods: any[] = []

  if (cluster === 'eu') {
    // For abstract 'eu' cluster, fetch pods from all concrete clusters in parallel
    const concreteClusters = ['eu-0', 'eu-1', 'eu-2'] as const
    const promises = concreteClusters.map(async (concreteCluster) => {
      try {
        const clusterClient = ctx.kube.client[concreteCluster as keyof typeof ctx.kube.client]
        const podsResponse = await clusterClient.CoreV1.namespace(ctx.kube.namespace).getPodList({
          labelSelector: 'ctnr.io/name',
          abortSignal: signal,
        })
        const clusterPods = podsResponse.items || []

        // Add cluster information to each pod for identification
        return clusterPods.map((pod: any) => ({
          ...pod,
          _cluster: concreteCluster,
        }))
      } catch (error) {
        console.warn(`Failed to fetch pods from cluster ${concreteCluster}:`, error)
        return []
      }
    })

    const results = await Promise.all(promises)
    results.forEach((clusterPods) => allPods.push(...clusterPods))
  } else {
    // For specific clusters, fetch pods only from that cluster
    try {
      const clusterClient = ctx.kube.client[cluster]
      const podsResponse = await clusterClient.CoreV1.namespace(ctx.kube.namespace).getPodList({
        labelSelector: 'ctnr.io/name',
        abortSignal: signal,
      })
      allPods.push(...(podsResponse.items || []))
    } catch (error) {
      console.warn(`Failed to fetch pods from cluster ${cluster}:`, error)
    }
  }

  return allPods
}

async function fetchRoutesOptimized(
  kubeClient: any,
  namespace: string,
): Promise<{ httpRoutes: any[]; ingressRoutes: any[] }> {
  // Fetch both route types in parallel
  const [httpRoutesResult, ingressRoutesResult] = await Promise.allSettled([
    kubeClient.GatewayNetworkingV1(namespace).listHTTPRoutes(),
    kubeClient.TraefikV1Alpha1(namespace).listIngressRoutes(),
  ])

  const httpRoutes = httpRoutesResult.status === 'fulfilled' ? (httpRoutesResult.value as any)?.items || [] : []

  const ingressRoutes = ingressRoutesResult.status === 'fulfilled'
    ? (ingressRoutesResult.value as any)?.items || []
    : []

  if (httpRoutesResult.status === 'rejected') {
    console.warn('Failed to fetch HTTP routes:', httpRoutesResult.reason)
  }

  if (ingressRoutesResult.status === 'rejected') {
    console.warn('Failed to fetch Ingress routes:', ingressRoutesResult.reason)
  }

  return { httpRoutes, ingressRoutes }
}
