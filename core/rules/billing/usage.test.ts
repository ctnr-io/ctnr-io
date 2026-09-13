import { assertEquals } from '@std/assert'
import { buildStorageFreezeQuotaPatch } from './usage.ts'

Deno.test('buildStorageFreezeQuotaPatch forces requests.storage to 0Gi with no prior quota', () => {
  const patch = buildStorageFreezeQuotaPatch({ namespace: 'ns-1' })
  assertEquals(patch, {
    apiVersion: 'policy.karmada.io/v1alpha1',
    kind: 'FederatedResourceQuota',
    metadata: { name: 'ctnr-resource-quota', namespace: 'ns-1' },
    spec: { overall: { 'requests.storage': '0Gi' } },
  })
})

Deno.test('buildStorageFreezeQuotaPatch preserves existing cpu/memory limits', () => {
  const patch = buildStorageFreezeQuotaPatch({
    namespace: 'ns-1',
    existingOverall: {
      'limits.cpu': '4',
      'limits.memory': '8Gi',
      'requests.storage': '50Gi',
    },
  })
  assertEquals(patch.spec.overall, {
    'limits.cpu': '4',
    'limits.memory': '8Gi',
    'requests.storage': '0Gi',
  })
})

Deno.test('buildStorageFreezeQuotaPatch overrides requests.storage even if previously set higher', () => {
  const patch = buildStorageFreezeQuotaPatch({
    namespace: 'ns-1',
    existingOverall: { 'requests.storage': '5Gi' },
  })
  assertEquals(patch.spec.overall['requests.storage'], '0Gi')
})

Deno.test('buildStorageFreezeQuotaPatch targets the namespace-scoped ctnr-resource-quota object', () => {
  const patch = buildStorageFreezeQuotaPatch({ namespace: 'customer-42' })
  assertEquals(patch.metadata, { name: 'ctnr-resource-quota', namespace: 'customer-42' })
})
