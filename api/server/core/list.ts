import { z } from 'zod'
import { ServerContext } from 'ctx/mod.ts'
import { ServerResponse } from './_common.ts'

export const Meta = {
  aliases: {
    options: {
      output: 'o',
    },
  },
}

export const Input = z.object({
  output: z.enum(['wide', 'name', 'json', 'yaml', 'raw']).optional(),
})

export type Input = z.infer<typeof Input>

export default async function* ({ ctx, input }: { ctx: ServerContext; input: Input }): ServerResponse<Input> {
  const { output = 'wide' } = input

  // List deployments with label ctnr.io/name
  const deployments = await ctx.kube.client.AppsV1.namespace(ctx.kube.namespace).getDeploymentList({
    labelSelector: 'ctnr.io/name',
  })

  if (deployments.items.length === 0) {
    yield 'No containers found.'
    return
  }

  // Get metrics for all pods in the namespace
  let podMetrics: any[] = []
  try {
    const metricsResponse = await ctx.kube.client.MetricsV1Beta1(ctx.kube.namespace).getPodsListMetrics()
    podMetrics = metricsResponse.items || []
  } catch (error) {
    console.warn('Failed to fetch pod metrics:', error)
    // Continue without metrics
  }

  // Get all pods for replica instances information
  const allPods = await ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).getPodList({
    labelSelector: 'ctnr.io/name',
  })

  // Get all routes for containers
  let httpRoutes: any[] = []
  let ingressRoutes: any[] = []
  try {
    const httpRoutesResponse = await ctx.kube.client.GatewayNetworkingV1(ctx.kube.namespace).listHTTPRoutes() as any
    httpRoutes = httpRoutesResponse?.items || []
  } catch (error) {
    console.warn('Failed to fetch HTTP routes:', error)
  }

  try {
    const ingressRoutesResponse = await ctx.kube.client.TraefikV1Alpha1(ctx.kube.namespace).listIngressRoutes() as any
    ingressRoutes = ingressRoutesResponse?.items || []
  } catch (error) {
    console.warn('Failed to fetch Ingress routes:', error)
  }

  // Transform deployments to container data (hide Kubernetes internals)
  const containers = await Promise.all(deployments.items.map(async (deployment) => {
    const annotations = deployment.metadata?.annotations || {}
    const labels = deployment.metadata?.labels || {}
    const spec = deployment.spec || {}
    const status = deployment.status || {}

    // Extract replica information from deployment spec and status
    const replicaInfo = await extractReplicaInfoWithInstances(deployment, allPods.items, podMetrics)

    // Get real resource usage from metrics API
    const resources = await extractResourceUsageFromMetrics(deployment, podMetrics, annotations)

    // Get routes for this container
    const routes = extractRoutesForContainer(deployment.metadata?.name || '', httpRoutes, ingressRoutes)

    // Extract cluster information from labels
    const clusters = extractClustersFromLabels(labels)

    // Get container info from deployment template
    const container = (spec as any).template?.spec?.containers?.[0]

    return {
      id: deployment.metadata?.uid || '',
      name: deployment.metadata?.name || '',
      image: container?.image || '',
      status: mapDeploymentStatusToContainerStatus(status),
      createdAt: new Date(deployment.metadata?.creationTimestamp || ''),
      ports: extractPortMappingsFromContainer(container?.ports || undefined),
      cpu: resources.cpu,
      memory: resources.memory,
      replicas: replicaInfo,
      routes: routes,
      clusters: clusters,
    }
  }))

  switch (output) {
    case 'raw':
      yield containers
      break

    case 'json':
      yield JSON.stringify(containers, null, 2)
      break

    case 'yaml':
      for (const container of containers) {
        yield `- id: ${container.id}`
        yield `  name: ${container.name}`
        yield `  image: ${container.image}`
        yield `  status: ${container.status}`
        yield `  createdAt: ${container.createdAt.toISOString()}`
        yield `  cpu: ${container.cpu}`
        yield `  memory: ${container.memory}`
        yield `  replicas:`
        yield `    max: ${container.replicas.max}`
        yield `    min: ${container.replicas.min}`
        yield `    current: ${container.replicas.current}`
        if (container.ports && container.ports.length > 0) {
          yield `  ports:`
          for (const port of container.ports) {
            yield `    - ${port}`
          }
        } else {
          yield `  ports: []`
        }
        if (container.clusters && container.clusters.length > 0) {
          yield `  clusters:`
          for (const cluster of container.clusters) {
            yield `    - ${cluster}`
          }
        } else {
          yield `  clusters: []`
        }
      }
      break

    case 'name':
      for (const container of containers) {
        yield container.name
      }
      break

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
      break
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
    const nodeName = pod.spec?.nodeName || 'Unknown'
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
      id: pod.metadata?.uid || '',
      name: podName,
      status: podStatus.toLowerCase(),
      node: nodeName,
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
  deployment: any,
  podMetrics: any[],
  annotations: any,
): { cpu: string; memory: string } {
  const deploymentName = deployment.metadata?.name

  // Find pods that belong to this deployment
  const deploymentPods = podMetrics.filter((podMetric) => {
    const labels = podMetric.metadata?.labels || {}
    return labels['ctnr.io/name'] === deploymentName
  })

  if (deploymentPods.length === 0) {
    // Fallback to resource limits/requests if no metrics available
    return extractResourceUsageFromDeployment(deployment, annotations)
  }

  // Aggregate CPU and memory usage across all pods for this deployment
  let totalCpuNano = 0
  let totalMemoryBytes = 0
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
        podCount++
      }
    }
  }

  // Convert back to readable format
  const cpuMillicores = Math.round(totalCpuNano / 1000000)
  const memoryMB = Math.round(totalMemoryBytes / (1024 * 1024))

  return {
    cpu: `${cpuMillicores}m`,
    memory: `${memoryMB}Mi`,
  }
}

function extractResourceUsageFromDeployment(deployment: any, annotations: any): { cpu: string; memory: string } {
  // Extract resource usage from annotations or calculate from container resources
  const container = deployment.spec?.template?.spec?.containers?.[0]
  const resources = container?.resources

  // Try annotations first, then fall back to resource requests/limits
  let cpu = annotations['ctnr.io/cpu-usage']
  let memory = annotations['ctnr.io/memory-usage']

  if (!cpu && resources?.requests?.cpu) {
    cpu = String(resources.requests.cpu)
  } else if (!cpu && resources?.limits?.cpu) {
    cpu = String(resources.limits.cpu)
  } else if (!cpu) {
    cpu = '0.1%'
  }

  if (!memory && resources?.requests?.memory) {
    memory = String(resources.requests.memory)
  } else if (!memory && resources?.limits?.memory) {
    memory = String(resources.limits.memory)
  } else if (!memory) {
    memory = '64MB'
  }

  // Ensure we always return strings
  return {
    cpu: String(cpu || '0.1%'),
    memory: String(memory || '64MB'),
  }
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
