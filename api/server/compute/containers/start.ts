import { z } from 'zod'
import { Deployment } from '@cloudydeno/kubernetes-apis/apps/v1'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ServerContext } from 'ctx/mod.ts'
import { ContainerName } from 'lib/api/schemas.ts'
import { ensureHorizontalPodAutoscaler } from 'lib/kubernetes/kube-client.ts'
import { checkUsage } from 'lib/billing/usage.ts'
import { extractDeploymentResourceUsage } from 'lib/billing/resource.ts'

export const Meta = {
  aliases: {
    options: {
    },
  },
}

export const Input = z.object({
  name: ContainerName,
  force: z.boolean().optional().default(false).describe('Force start even if already running or insufficient resources'),
})

export type Input = z.infer<typeof Input>

export default async function* (request: ServerRequest<Input>): ServerResponse<void> {
  const { ctx, input, signal } = request

  const {
    name,
  } = input

  // Patch deployment replicas and add HPA if needed ---
  // Fetch deployment
  const deployment = await ctx.kube.client['karmada'].AppsV1.namespace(ctx.kube.namespace).getDeployment(name)
  if (!deployment) throw new Error('Deployment not found')

  const resources = extractDeploymentResourceUsage(deployment)

  yield* checkUsage({
    kubeClient: ctx.kube.client['karmada'],
    namespace: ctx.kube.namespace,
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

  // Patch deployment to set replicas
  await ctx.kube.client['karmada'].AppsV1.namespace(ctx.kube.namespace).patchDeployment(name, 'json-merge', {
    spec: { replicas: minReplicas, template: {}, selector: {} },
  })

  // If minReplicas != maxReplicas, create or update HPA
  if (minReplicas !== maxReplicas) {
    await ensureHorizontalPodAutoscaler(ctx.kube.client['karmada'], ctx.kube.namespace, {
      apiVersion: 'autoscaling/v2',
      kind: 'HorizontalPodAutoscaler',
      metadata: {
        name,
        namespace: ctx.kube.namespace,
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

  await waitForDeployment({
    ctx,
    name,
    predicate: (deployment) => {
      const status = deployment.status
      return !!status?.readyReplicas && status?.readyReplicas >= minReplicas
    },
    signal,
  })

  yield `✅ Containers ${name} started`
}

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
