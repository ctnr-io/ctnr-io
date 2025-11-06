import { Pod } from '@cloudydeno/kubernetes-apis/core/v1'
import { ServerContext } from 'ctx/mod.ts'
import { ClusterName } from 'lib/api/schemas.ts'

export async function getPodsFromAllClusters({
  ctx,
  signal,
  name,
  replicas,
}: {
  ctx: ServerContext
  signal: AbortSignal
  name: string
  replicas?: string[]
}): Promise<{
  cluster: ClusterName
  pod: Pod
}[]> {
  // First, try to find the deployment
  const deployment = await ctx.kube.client['karmada'].AppsV1.namespace(ctx.kube.namespace).getDeployment(name, {
    abortSignal: signal,
  }).catch(() => null)

  if (!deployment) {
    throw new Error(`Container ${name} not found`)
  }

  // Get cluster from deployment labels
  const labels = deployment.metadata?.labels || {}
  const clusters = Object.entries(labels)
    .filter(([key, value]) => key.startsWith('cluster.ctnr.io/') && value === 'true')
    .map(([key]) => key.replace('cluster.ctnr.io/', ''))

  if (clusters.length === 0) {
    throw new Error(`No clusters found for container ${name}`)
  }

  // Get running pods from all clusters
  const allPods: Array<{ pod: Pod; cluster: ClusterName }> = []

  await Promise.all(clusters.map(async (cluster) => {
    try {
      const pods = await ctx.kube.client[cluster as keyof typeof ctx.kube.client].CoreV1.namespace(ctx.kube.namespace)
        .getPodList({
          labelSelector: `ctnr.io/name=${name}`,
          abortSignal: signal,
        })

      const runningPods = pods.items
        .filter((pod) => pod.status?.phase === 'Running')
        .map((pod) => ({ pod, cluster: cluster as ClusterName }))

      allPods.push(...runningPods)
    } catch (error) {
      console.warn(`Failed to get pods from cluster ${cluster}:`, error)
    }
  }))

  if (allPods.length === 0) {
    throw new Error(`No running replicas found for container ${name}`)
  }

  // Filter by replica if specified
  const targetPods = replicas && replicas.length > 0
    ? allPods.filter((pod) => replicas.includes(pod.pod.metadata?.name || ''))
    : allPods
  if (targetPods.length === 0) {
    throw new Error(`No matching replicas found for container ${name}`)
  }

  return targetPods
}
