import { match } from 'ts-pattern'
import { KubeClient } from './mod.ts'
import { JSONObject } from '@cloudydeno/kubernetes-apis/deps.ts'
import { ObjectMeta } from '../mod.ts'

type Resource = {
  apiVersion: string
  kind: string
  metadata: ObjectMeta
  spec?: JSONObject
  data?: JSONObject
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
    const isClusterScoped = !namespace || resource.kind === 'Namespace'

    // Determine if this is a core API resource
    const apiPrefix = resource.apiVersion.includes('/') ? '/apis' : '/api'

    // Build the resource path for DELETE
    const path = [
      `${apiPrefix}/${resource.apiVersion}`,
      isClusterScoped ? '' : `/namespaces/${namespace}`,
      `/${getPluralKind(resource.kind)}`,
      `/${name}`,
    ].filter(Boolean).join('')

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
  const isClusterScoped = !('namespace' in resource.metadata) || resource.kind === 'Namespace'

  // Determine if this is a core API resource
  const apiPrefix = resource.apiVersion.includes('/') ? '/apis' : '/api'

  // Build the resource path (GET, PUT, DELETE)
  const resourcePath = [
    `${apiPrefix}/${resource.apiVersion}`,
    isClusterScoped ? '' : `/namespaces/${namespace}`,
    `/${getPluralKind(resource.kind)}`,
    `/${name}`,
  ].filter(Boolean).join('')

  // Build the collection path (POST)
  const collectionPath = [
    `${apiPrefix}/${resource.apiVersion}`,
    isClusterScoped ? '' : `/namespaces/${namespace}`,
    `/${getPluralKind(resource.kind)}`,
  ].filter(Boolean).join('')

  await match(
    // Get the resource and return null if it does not exist
    await kc.performRequest({
      method: 'GET',
      path: resourcePath,
      abortSignal,
      expectJson: true,
    }).catch(() => null) as unknown as T | null,
  )
    .with(
      null,
      () =>
        kc.performRequest({
          method: 'POST',
          path: collectionPath,
          bodyJson: resource,
          abortSignal,
        }).then((data) => {
          const dataStr = new TextDecoder().decode(data)
          console.log(`Created ${resource.kind} ${name} in namespace ${namespace}:`, dataStr)
          if (dataStr.includes('404 page not found')) {
            throw new Error(`Failed to create ${resource.kind} ${name} in namespace ${namespace}: 404 page not found`)
          }
          return data
        }).catch((err) => {
          console.error(`Failed to create ${resource.kind} ${name} in namespace ${namespace}:`, err)
          throw err
        }),
    )
    .with({
      metadata: resource.metadata,
      ...('spec' in resource ? { spec: resource.spec } : {}),
      ...('data' in resource ? { data: resource.data } : {}),
    } as any, () => true)
    .otherwise(async (current: Resource) => {
      const bodyJson = {
        // Merge metadata
        metadata: {
          ...resource.metadata,
          labels: {
            ...current.metadata.labels,
            ...resource.metadata.labels,
          },
          annotations: {
            ...current.metadata.annotations,
            ...resource.metadata.annotations,
          },
        },
        // Replace spec
        ...('spec' in resource ? { spec: resource.spec } : { spec: current.spec }),
        // Replace data
        ...('data' in resource ? { data: resource.data } : { data: current.data }),
      }
      switch (opts.strategy) {
        case 'update':
          console.debug(`Updating existing ${resource.kind} ${name} in namespace ${namespace}`)
          return kc.performRequest({
            method: 'PUT',
            path: resourcePath,
            bodyJson,
            abortSignal,
          })
        case 'replace':
          console.debug(`Replacing existing ${resource.kind} ${name} in namespace ${namespace}`)
          // Delete the existing resource first
          await kc.performRequest({
            method: 'DELETE',
            path: resourcePath,
            abortSignal,
          })
          // Then create the new one
          return ensureResource(kc, resource, abortSignal, opts)
      }
    })
}
