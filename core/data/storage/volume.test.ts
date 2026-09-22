import { assertEquals, assertStrictEquals } from '@std/assert'
import { ensureVolume } from './volume.ts'

// deno-lint-ignore no-explicit-any
function fakeKubeClient(onCreate: (manifest: any) => void): any {
  return {
    CoreV1: {
      namespace: (_ns: string) => ({
        getPersistentVolumeClaim: (_name: string) => {
          const err: any = new Error('not found')
          err.httpCode = 404
          throw err
        },
        // deno-lint-ignore no-explicit-any
        createPersistentVolumeClaim: (manifest: any) => {
          onCreate(manifest)
          return manifest
        },
      }),
    },
  }
}

Deno.test('ensureVolume omits storageClassName when CTNR_DEFAULT_STORAGE_CLASS is unset (byte-identical to prior behaviour)', async () => {
  assertStrictEquals(Deno.env.get('CTNR_DEFAULT_STORAGE_CLASS'), undefined)

  // deno-lint-ignore no-explicit-any
  let created: any = null
  const kubeClient = fakeKubeClient((manifest) => created = manifest)

  const gen = ensureVolume({ name: 'vol', size: '1Gi', namespace: 'ns', kubeClient })
  for await (const _ of gen) { /* drain progress messages */ }

  assertEquals('storageClassName' in created.spec, false)
})
