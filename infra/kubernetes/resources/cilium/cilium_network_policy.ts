import { match } from 'ts-pattern'
import { KubeClient } from 'infra/kubernetes/client/mod.ts'
import { CiliumNetworkPolicy } from 'infra/kubernetes/types/cilium.ts'

export async function ensureCiliumNetworkPolicy(
  kc: KubeClient,
  namespace: string,
  networkPolicy: CiliumNetworkPolicy,
  abortSignal: AbortSignal,
): Promise<void> {
  const networkPolicyName = networkPolicy.metadata.name
  await match(
    // Get the network policy and return null if it does not exist
    await kc.performRequest({
      method: 'GET',
      path: `/apis/cilium.io/v2/namespaces/${namespace}/ciliumnetworkpolicies/${networkPolicyName}`,
      expectJson: true,
      abortSignal,
    })
      .then((res) => res as any)
      .catch(() => null),
  )
    // if network policy does not exist, create it
    .with(null, () =>
      kc.performRequest({
        method: 'POST',
        path: `/apis/cilium.io/v2/namespaces/${namespace}/ciliumnetworkpolicies`,
        bodyJson: networkPolicy as any,
        expectJson: true,
        abortSignal,
      }))
    // if network policy exists, and match values, do nothing, else, replace it to ensure it match
    .with(networkPolicy, () => true)
    .otherwise(async () => {
      console.debug('Replacing existing CiliumNetworkPolicy', networkPolicyName)
      // Delete the existing network policy first
      console.log(
        await kc.performRequest({
          method: 'DELETE',
          path: `/apis/cilium.io/v2/namespaces/${namespace}/ciliumnetworkpolicies/${networkPolicyName}`,
          expectJson: true,
          abortSignal,
        }),
      )
      // Then create the new one
      return kc.performRequest({
        method: 'POST',
        path: `/apis/cilium.io/v2/namespaces/${namespace}/ciliumnetworkpolicies/${networkPolicyName}`,
        bodyJson: networkPolicy as any,
        expectJson: true,
        abortSignal,
      })
    })
}
