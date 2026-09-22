import { assertEquals, assertStrictEquals } from '@std/assert'
import { volumeInputToPvc } from './volume.ts'

Deno.test('volumeInputToPvc defaults storageClassName to "default" when CTNR_DEFAULT_STORAGE_CLASS is unset (byte-identical to prior behaviour)', () => {
  assertStrictEquals(Deno.env.get('CTNR_DEFAULT_STORAGE_CLASS'), undefined)

  const pvc = volumeInputToPvc({ name: 'vol', size: '1Gi' }, 'ns')
  // deno-lint-ignore no-explicit-any
  assertEquals((pvc.spec as any).storageClassName, 'default')
})

Deno.test('volumeInputToPvc uses the explicit storageClass input when provided', () => {
  const pvc = volumeInputToPvc({ name: 'vol', size: '1Gi', storageClass: 'mk8s-ceph-block-europe-west-0' }, 'ns')
  // deno-lint-ignore no-explicit-any
  assertEquals((pvc.spec as any).storageClassName, 'mk8s-ceph-block-europe-west-0')
})
