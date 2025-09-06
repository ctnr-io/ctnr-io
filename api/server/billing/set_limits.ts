import { Tier } from 'lib/billing/utils.ts'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import z from 'zod'
import { ensureFederatedResourceQuota } from 'lib/kubernetes/kube-client.ts'
import { ResourceLimits } from 'lib/billing/utils.ts'

export const Meta = {}

export const Input = z.object({
  cpu: z.union([z.string().regex(/^\d+$/)]).refine(
    (val) => {
      const cpuValue = ResourceLimits.cpu.fromString(val)
      return cpuValue >= ResourceLimits.cpu.min && cpuValue <= ResourceLimits.cpu.max
    },
    `CPU limit must be between ${ResourceLimits.cpu.display(ResourceLimits.cpu.min)} and ${
      ResourceLimits.cpu.display(ResourceLimits.cpu.max)
    }`,
  ).describe('CPU limit'),
  memory: z.string().regex(/^\d+G/).refine(
    (val) => {
      const memoryValue = ResourceLimits.memory.fromString(val)
      return memoryValue >= ResourceLimits.memory.min && memoryValue <= ResourceLimits.memory.max
    },
    `Memory limit must be between ${ResourceLimits.memory.display(ResourceLimits.memory.min)} and ${
      ResourceLimits.memory.display(ResourceLimits.memory.max)
    }`,
  ).describe('Memory limit'),
  storage: z.string().regex(/^\d+[GT]/).refine(
    (val) => {
      const storageValue = ResourceLimits.storage.fromString(val)
      return storageValue >= ResourceLimits.storage.min && storageValue <= ResourceLimits.storage.max
    },
    `Storage limit must be between ${ResourceLimits.storage.display(ResourceLimits.storage.min)} and ${
      ResourceLimits.storage.display(ResourceLimits.storage.max)
    }`,
  ).describe('Storage limit'),
})
export type Input = z.infer<typeof Input>

export type Output = void

export default async function* (
  request: ServerRequest<Input>,
): ServerResponse<Output> {
  const { ctx, input, signal } = request

  const kubeClient = ctx.kube.client['eu']
  const namespace = ctx.kube.namespace

  const namespaceObj = await kubeClient.CoreV1.getNamespace(namespace)

  const creditsAnnotation = namespaceObj.metadata?.annotations?.['ctnr.io/credits-balance']
  const credits = parseInt(creditsAnnotation || '0', 10)
  if (credits === 0) {
    // Set requests to default
    await ensureFederatedResourceQuota(kubeClient, namespace, {
      apiVersion: 'policy.karmada.io/v1alpha1',
      kind: 'FederatedResourceQuota',
      metadata: {
        name: 'ctnr-resource-quota',
        namespace: namespace,
        labels: {},
      },
      spec: {
        overall: {
          'limits.cpu': Tier['free'].cpu,
          'limits.memory': Tier['free'].memory,
          'requests.storage': Tier['free'].storage,
        },
      },
    }, signal)
    throw new Error('User has no credits, limits set to Free Tier')
  }

  await ensureFederatedResourceQuota(kubeClient, namespace, {
    apiVersion: 'policy.karmada.io/v1alpha1',
    kind: 'FederatedResourceQuota',
    metadata: {
      name: 'ctnr-resource-quota',
      namespace: namespace,
      labels: {},
    },
    spec: {
      overall: {
        'limits.cpu': input.cpu,
        'limits.memory': input.memory,
        'requests.storage': input.storage,
      },
    },
  }, signal)
}
