import { Namespace } from '@cloudydeno/kubernetes-apis/core/v1'
import { KubeClient } from 'infra/kubernetes/client/mod.ts'
import { match } from 'ts-pattern'


export async function ensureNamespace(
  kc: KubeClient,
  namespaceObj: Namespace,
  abortSignal: AbortSignal,
): Promise<void> {
  const namespace = namespaceObj.metadata!.name!
  await match(
    // Get the namespace and return null if it does not exist
    await kc.CoreV1.getNamespace(namespace, { abortSignal }).catch(() => null),
  )
    // if namespace does not exist, create it
    .with(null, () => kc.CoreV1.createNamespace(namespaceObj, { abortSignal }))
    // if namespace exists, and match values, do nothing, else, patch it to ensure it match
    .with(namespace as any, () => true)
    .otherwise(() =>
      kc.CoreV1.patchNamespace(
        namespace,
        'apply-patch',
        namespaceObj,
        {
          fieldManager: 'ctnr.io',
          abortSignal,
        },
      )
    )
}
