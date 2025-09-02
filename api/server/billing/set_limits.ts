import { Tier } from 'lib/billing/utils.ts'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import z from 'zod'
import { ensureFederatedResourceQuota } from 'lib/kubernetes/kube-client.ts'

export const Input = z.object({
  cpu: z.union([z.string().regex(/^\d+m?$/)]).describe('CPU limit'),
  memory: z.string().regex(/^\d[MG]i/).describe('Memory limit'),
  storage: z.string().regex(/^\d[MG]i/).describe('Storage limit'),
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
    // Set limits to default
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
          'limits.storage': Tier['free'].storage,
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
        'limits.storage': input.storage,
      },
    },
  }, signal)
}
