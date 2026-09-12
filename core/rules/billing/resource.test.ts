import { assertEquals } from '@std/assert'
import { toQuantity } from '@cloudydeno/kubernetes-apis/common.ts'
import type { Deployment } from '@cloudydeno/kubernetes-apis/apps/v1'
import {
  extractDeploymentCurrentResourceUsage,
  extractDeploymentMaximumResourceUsage,
  extractDeploymentMinimumResourceUsage,
  parseResourceToPrimitiveValue,
} from './resource.ts'

function deploymentWithResources(opts: {
  limits?: Record<string, string>
  requests?: Record<string, string>
  annotations?: Record<string, string>
  status?: Record<string, unknown>
}): Deployment {
  const resources: Record<string, unknown> = {}
  if (opts.limits) {
    resources.limits = Object.fromEntries(
      Object.entries(opts.limits).map(([key, value]) => [key, toQuantity(value)]),
    )
  }
  if (opts.requests) {
    resources.requests = Object.fromEntries(
      Object.entries(opts.requests).map(([key, value]) => [key, toQuantity(value)]),
    )
  }
  return {
    metadata: { annotations: opts.annotations ?? {} },
    spec: { template: { spec: { containers: [{ resources }] } } },
    status: opts.status ?? {},
  } as unknown as Deployment
}

// --- parseResourceToPrimitiveValue: cpu ---

Deno.test('cpu 250m parses to 250 millicores', () => {
  assertEquals(parseResourceToPrimitiveValue('250m', 'cpu'), 250)
})

Deno.test('cpu bare 1 parses to 1000 millicores', () => {
  assertEquals(parseResourceToPrimitiveValue('1', 'cpu'), 1000)
})

Deno.test('cpu 1500000u (microcores) parses to 1500 millicores', () => {
  assertEquals(parseResourceToPrimitiveValue('1500000u', 'cpu'), 1500)
})

Deno.test('cpu 250000000n (nanocores) parses to 250 millicores', () => {
  assertEquals(parseResourceToPrimitiveValue('250000000n', 'cpu'), 250)
})

Deno.test('cpu garbage value parses to 0', () => {
  assertEquals(parseResourceToPrimitiveValue('garbage', 'cpu'), 0)
})

// --- parseResourceToPrimitiveValue: memory ---

Deno.test('memory binary Mi/MiB pass through unchanged', () => {
  assertEquals(parseResourceToPrimitiveValue('512Mi', 'memory'), 512)
  assertEquals(parseResourceToPrimitiveValue('512MiB', 'memory'), 512)
})

Deno.test('memory binary Gi/GiB convert to Mi', () => {
  assertEquals(parseResourceToPrimitiveValue('2Gi', 'memory'), 2048)
  assertEquals(parseResourceToPrimitiveValue('2GiB', 'memory'), 2048)
})

Deno.test('memory binary Ki/KiB convert to Mi with rounding', () => {
  assertEquals(parseResourceToPrimitiveValue('1500Ki', 'memory'), 1)
  assertEquals(parseResourceToPrimitiveValue('1500KiB', 'memory'), 1)
})

Deno.test('memory decimal M/MB do not equal the same numeric value in Mi (decimal vs binary boundary)', () => {
  assertEquals(parseResourceToPrimitiveValue('256M', 'memory'), 244.140625)
  assertEquals(parseResourceToPrimitiveValue('256MB', 'memory'), 244.140625)
})

Deno.test('memory decimal G/GB convert to Mi', () => {
  assertEquals(parseResourceToPrimitiveValue('1G', 'memory'), 953.67431640625)
  assertEquals(parseResourceToPrimitiveValue('1GB', 'memory'), 953.67431640625)
})

Deno.test('memory decimal K/KB convert to Mi', () => {
  assertEquals(parseResourceToPrimitiveValue('1K', 'memory'), 0.00095367431640625)
  assertEquals(parseResourceToPrimitiveValue('1KB', 'memory'), 0.00095367431640625)
})

Deno.test('memory bare value is treated as bytes', () => {
  assertEquals(parseResourceToPrimitiveValue('1048576', 'memory'), 1)
})

Deno.test('memory garbage value parses to 0', () => {
  assertEquals(parseResourceToPrimitiveValue('garbage', 'memory'), 0)
})

// --- parseResourceToPrimitiveValue: storage ---

Deno.test('storage binary Gi/GiB pass through unchanged', () => {
  assertEquals(parseResourceToPrimitiveValue('3Gi', 'storage'), 3)
  assertEquals(parseResourceToPrimitiveValue('3GiB', 'storage'), 3)
})

Deno.test('storage binary Ti/TiB convert to Gi', () => {
  assertEquals(parseResourceToPrimitiveValue('1Ti', 'storage'), 1024)
  assertEquals(parseResourceToPrimitiveValue('1TiB', 'storage'), 1024)
})

Deno.test('storage binary Mi converts down to Gi', () => {
  assertEquals(parseResourceToPrimitiveValue('1024Mi', 'storage'), 1)
})

Deno.test('storage decimal G/GB convert to Gi', () => {
  assertEquals(parseResourceToPrimitiveValue('1G', 'storage'), 0.9313225746154785)
  assertEquals(parseResourceToPrimitiveValue('1GB', 'storage'), 0.9313225746154785)
})

Deno.test('storage decimal T converts to Gi', () => {
  assertEquals(parseResourceToPrimitiveValue('1T', 'storage'), 931.3225746154785)
})

Deno.test('storage decimal M converts to Gi', () => {
  assertEquals(parseResourceToPrimitiveValue('1M', 'storage'), 0.0009313225746154785)
})

Deno.test('storage bare value is treated as bytes', () => {
  assertEquals(parseResourceToPrimitiveValue('1073741824', 'storage'), 1)
})

Deno.test('storage garbage value parses to 0', () => {
  assertEquals(parseResourceToPrimitiveValue('garbage', 'storage'), 0)
})

// --- extractDeploymentMinimumResourceUsage / extractDeploymentMaximumResourceUsage ---

Deno.test('minimum usage uses explicit limits and the min-replicas annotation', () => {
  const deployment = deploymentWithResources({
    limits: { cpu: '500m', memory: '512Mi', 'ephemeral-storage': '3Gi' },
    annotations: { 'ctnr.io/min-replicas': '3' },
  })
  assertEquals(extractDeploymentMinimumResourceUsage(deployment), {
    cpu: '1500m',
    memory: '1536MiB',
    storage: '3Gi',
    replicas: 3,
  })
})

Deno.test('maximum usage uses explicit limits and the max-replicas annotation', () => {
  const deployment = deploymentWithResources({
    limits: { cpu: '500m', memory: '512Mi', 'ephemeral-storage': '3Gi' },
    annotations: { 'ctnr.io/max-replicas': '4' },
  })
  assertEquals(extractDeploymentMaximumResourceUsage(deployment), {
    cpu: '2000m',
    memory: '2048MiB',
    storage: '4Gi',
    replicas: 4,
  })
})

Deno.test('usage falls back to requests when limits are absent, with default replicas of 1', () => {
  const deployment = deploymentWithResources({
    requests: { cpu: '100m', memory: '256Mi', 'ephemeral-storage': '2Gi' },
  })
  const expected = {
    cpu: '100m',
    memory: '256MiB',
    storage: '0.6666666666666666Gi',
    replicas: 1,
  }
  assertEquals(extractDeploymentMinimumResourceUsage(deployment), expected)
  assertEquals(extractDeploymentMaximumResourceUsage(deployment), expected)
})

Deno.test('usage falls back to hardcoded defaults when neither limits nor requests are set', () => {
  const deployment = deploymentWithResources({})
  const expected = {
    cpu: '250m',
    memory: '488.28125MiB',
    storage: '0.3104408582051595Gi',
    replicas: 1,
  }
  assertEquals(extractDeploymentMinimumResourceUsage(deployment), expected)
  assertEquals(extractDeploymentMaximumResourceUsage(deployment), expected)
})

Deno.test('an absent min-replicas annotation defaults replicas to 1', () => {
  const deployment = deploymentWithResources({
    limits: { cpu: '250m', memory: '512Mi', 'ephemeral-storage': '1Gi' },
  })
  assertEquals(extractDeploymentMinimumResourceUsage(deployment), {
    cpu: '250m',
    memory: '512MiB',
    storage: '0.3333333333333333Gi',
    replicas: 1,
  })
})

Deno.test('a garbage min-replicas annotation propagates as NaN in replicas and the totals', () => {
  const deployment = deploymentWithResources({
    limits: { cpu: '250m', memory: '512Mi', 'ephemeral-storage': '1Gi' },
    annotations: { 'ctnr.io/min-replicas': 'garbage' },
  })
  const usage = extractDeploymentMinimumResourceUsage(deployment)
  assertEquals(usage.cpu, 'NaNm')
  assertEquals(usage.memory, 'NaNMiB')
  assertEquals(usage.storage, 'NaNGi')
  assertEquals(Number.isNaN(usage.replicas), true)
})

// --- extractDeploymentCurrentResourceUsage: replica source order ---

Deno.test('current usage prefers readyReplicas over availableReplicas', () => {
  const deployment = deploymentWithResources({
    limits: { cpu: '250m', memory: '512Mi', 'ephemeral-storage': '1Gi' },
    status: { readyReplicas: 2, availableReplicas: 5 },
  })
  assertEquals(extractDeploymentCurrentResourceUsage(deployment), {
    cpu: '500m',
    memory: '1024MiB',
    storage: '0.6666666666666666Gi',
    replicas: 2,
  })
})

Deno.test('current usage falls back to availableReplicas when readyReplicas is absent', () => {
  const deployment = deploymentWithResources({
    limits: { cpu: '250m', memory: '512Mi', 'ephemeral-storage': '1Gi' },
    status: { availableReplicas: 3 },
  })
  assertEquals(extractDeploymentCurrentResourceUsage(deployment), {
    cpu: '750m',
    memory: '1536MiB',
    storage: '1Gi',
    replicas: 3,
  })
})

Deno.test('current usage falls back to 0 when neither readyReplicas nor availableReplicas is set', () => {
  const deployment = deploymentWithResources({
    limits: { cpu: '250m', memory: '512Mi', 'ephemeral-storage': '1Gi' },
    status: {},
  })
  assertEquals(extractDeploymentCurrentResourceUsage(deployment), {
    cpu: '0m',
    memory: '0MiB',
    storage: '0Gi',
    replicas: 0,
  })
})
