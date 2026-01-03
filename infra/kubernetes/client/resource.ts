import { match } from 'ts-pattern'
import { KubeClient } from './mod.ts'
import { JSONObject } from '@cloudydeno/kubernetes-apis/deps.ts'
import { ObjectMeta } from '../mod.ts'

type Resource = {
  apiVersion: string
  kind: string
  metadata: ObjectMeta
  spec?: JSONObject
}

export function createEnsureResourceFunction<T extends Resource>(opts: { strategy: 'update' | 'replace' }) {
  return async (
    kc: KubeClient,
    resource: T,
    abortSignal: AbortSignal,
  ) => {
    return ensureResource(kc, resource, abortSignal, opts)
  }
}

export async function createDeleteResourceFunction<T extends Resource>() {
  return async (
    kc: KubeClient,
    resource: T,
    abortSignal: AbortSignal,
  ) => {
    const namespace = resource.metadata.namespace
    const name = resource.metadata.name
    const path = `/apis/${resource.apiVersion}/namespaces/${namespace}/${getPluralKind(resource.kind)}/${name}`
    await kc.performRequest({
      method: 'DELETE',
      path,
      abortSignal,
    }).catch(() => null)
  }
}

function getPluralKind(kind: string): string {
  switch (true) {
    case kind.endsWith('s'):
      return kind.toLowerCase() + 'es'
    case kind.endsWith('y'):
      return kind.slice(0, -1).toLowerCase() + 'ies'
    default:
      return kind.toLowerCase() + 's'
  }
}

async function ensureResource<T extends Resource>(
  kc: KubeClient,
  resource: T,
  abortSignal: AbortSignal,
  opts: { strategy: 'update' | 'replace' },
): Promise<void> {
  const namespace = resource.metadata.namespace
  const name = resource.metadata.name
  const path = `/apis/${resource.apiVersion}/namespaces/${namespace}/${getPluralKind(resource.kind)}/${name}`
  await match(
    // Get the resource and return null if it does not exist
    await kc.performRequest({
      method: 'GET',
      path,
      abortSignal,
      expectJson: true,
    }).catch(() => null) as unknown as T | null,
  )
    .with(
      null,
      () =>
        kc.performRequest({
          method: 'POST',
          path,
          bodyJson: resource,
          abortSignal,
        }),
    )
    .with({
      metadata: resource.metadata, 
      spec: resource.spec,
    } as any, () => true)
    .otherwise(async (data) => {
      switch (opts.strategy) {
        case 'update':
          console.debug(`Updating existing ${resource.kind} ${name} in namespace ${namespace}`)
          return kc.performRequest({
            method: 'PUT',
            path,
            bodyJson: resource,
            abortSignal,
          })
        case 'replace':
          console.debug(`Replacing existing ${resource.kind} ${name} in namespace ${namespace}`)
          // Delete the existing resource first
          await kc.performRequest({
            method: 'DELETE',
            path,
            abortSignal,
          })
          // Then create the new one
          while (
            await kc.performRequest({
              method: 'POST',
              path,
              bodyJson: resource,
              abortSignal,
            }).catch(() => null) === null
          ) {
            // Wait until the resource is fully deleted before creating a new one
            console.debug(`Waiting for ${resource.kind} ${name} in namespace ${namespace} to be deleted...`)
            await new Promise((resolve) => setTimeout(resolve, 1000))
          }
      }
    })
}
