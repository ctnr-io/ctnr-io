import { z } from 'zod'
import { Deployment } from '@cloudydeno/kubernetes-apis/apps/v1'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ContainerName } from 'lib/api/schemas.ts'
import { ensureHorizontalPodAutoscaler } from 'infra/kubernetes/mod.ts'
import { checkUsage } from 'core/rules/billing/usage.ts'
import { extractDeploymentResourceUsage } from 'core/rules/billing/resource.ts'
import { type ContainerContext, getDeployment, scaleContainer, watchDeployments } from 'core/data/compute/container.ts'

export const Meta = {
  aliases: {
    options: {},
  },
}

export const Input = z.object({
  name: ContainerName.meta({ positional: true }),
  force: z.boolean().optional().default(false).describe(
    'Force start even if already running or insufficient resources',
  ),
})

export type Input = z.infer<typeof Input>

export default async function* startContainer(request: ServerRequest<Input>): ServerResponse<void> {
  const { ctx, input, signal } = request
  const { name } = input

  const containerCtx = {
    kubeClient: ctx.kube.client.karmada,
    namespace: ctx.project.namespace,
  }

  // Fetch deployment
  const deployment = await getDeployment(containerCtx, name, { signal })
  if (!deployment) throw new Error('Deployment not found')

  const resources = extractDeploymentResourceUsage(deployment)

  yield* checkUsage({
    kubeClient: ctx.kube.client['karmada'],
    namespace: ctx.project.namespace,
    signal,
    additionalResource: resources.min,
    force: input.force,
  })

  const minReplicas = resources.min.replicas
  const maxReplicas = resources.max.replicas

  if (minReplicas !== maxReplicas) {
    yield `🚀 Starting containers ${name} with ${minReplicas} replicas with auto scaling to ${maxReplicas}`
  } else {
    yield `🚀 Starting containers ${name} with ${minReplicas} replicas`
  }

  // Scale deployment
  await scaleContainer(containerCtx, name, minReplicas)

  // If minReplicas != maxReplicas, create or update HPA
  if (minReplicas !== maxReplicas) {
    await ensureHorizontalPodAutoscaler(ctx.kube.client['karmada'], {
      apiVersion: 'autoscaling/v2',
      kind: 'HorizontalPodAutoscaler',
      metadata: {
        name,
        namespace: ctx.project.namespace,
        labels: deployment.metadata?.labels || {},
      },
      spec: {
        scaleTargetRef: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          name,
        },
        minReplicas,
        maxReplicas,
        metrics: [
          {
            type: 'Resource',
            resource: {
              name: 'cpu',
              target: {
                type: 'Utilization',
                averageUtilization: 80,
              },
            },
          },
          {
            type: 'Resource',
            resource: {
              name: 'memory',
              target: {
                type: 'Utilization',
                averageUtilization: 80,
              },
            },
          },
        ],
      },
    }, signal)
  }

  yield* waitForDeployment({
    containerCtx,
    name,
    predicate: (deployment) => {
      const status = deployment.status
      return !!status?.readyReplicas && status?.readyReplicas >= minReplicas
    },
    signal,
    progress: (deployment) =>
      `⏳ Containers ${name}: ${deployment.status?.readyReplicas ?? 0}/${minReplicas} replicas ready`,
  })

  yield `✅ Containers ${name} started`
}

async function* waitForDeployment({ containerCtx, name, predicate, signal, progress }: {
  containerCtx: ContainerContext
  name: string
  predicate: (deployment: Deployment) => boolean | Promise<boolean>
  signal: AbortSignal
  progress: (deployment: Deployment) => string
}): ServerResponse<Deployment> {
  const deploymentWatcher = await watchDeployments(containerCtx, {
    labelSelector: `ctnr.io/name=${name}`,
    signal,
  })
  const reader = deploymentWatcher.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      const deployment = value?.object as Deployment
      if (deployment?.metadata?.name === name) {
        yield progress(deployment)
        if (await predicate(deployment)) {
          return deployment
        }
      }
      if (done) {
        return deployment
      }
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
}
