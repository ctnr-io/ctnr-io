import { assertEquals } from '@std/assert'
import type { Deployment } from '@cloudydeno/kubernetes-apis/apps/v1'
import type { Pod } from '@cloudydeno/kubernetes-apis/core/v1'
import {
  buildStatusText,
  containerInputToDeployment,
  deploymentToContainer,
  extractReplicas,
  mapDeploymentStatus,
} from './container.ts'

function deploymentWithImage(image: string): Deployment {
  return containerInputToDeployment({ name: 'app', namespace: 'ns', image }) as Deployment
}

function containerEnv(env: string[]): Array<{ name?: string; value?: string | null }> {
  const deployment = containerInputToDeployment({ name: 'app', namespace: 'ns', image: 'nginx:1.27', env })
  return deployment.spec?.template?.spec?.containers?.[0]?.env ?? []
}

Deno.test('env value keeps every character after the first =', () => {
  assertEquals(containerEnv(['DATABASE_URL=postgres://u:p@h/db?sslmode=require']), [
    { name: 'DATABASE_URL', value: 'postgres://u:p@h/db?sslmode=require' },
  ])
})

Deno.test('env entry without = gets an empty value', () => {
  assertEquals(containerEnv(['FLAG']), [{ name: 'FLAG', value: '' }])
})

Deno.test('image tag is split off the last colon', () => {
  const container = deploymentToContainer(deploymentWithImage('nginx:1.27'))
  assertEquals(container.image, 'nginx')
  assertEquals(container.tag, '1.27')
})

Deno.test('a registry port is not mistaken for a tag', () => {
  const container = deploymentToContainer(deploymentWithImage('registry.example.com:5000/team/app:v1'))
  assertEquals(container.image, 'registry.example.com:5000/team/app')
  assertEquals(container.tag, 'v1')
})

Deno.test('an untagged image on a ported registry has no tag', () => {
  const container = deploymentToContainer(deploymentWithImage('registry.example.com:5000/team/app'))
  assertEquals(container.image, 'registry.example.com:5000/team/app')
  assertEquals(container.tag, undefined)
})

Deno.test('a digest reference is kept whole', () => {
  const digest = 'sha256:0000000000000000000000000000000000000000000000000000000000000000'
  const container = deploymentToContainer(deploymentWithImage(`app@${digest}`))
  assertEquals(container.image, 'app')
  assertEquals(container.tag, digest)
})

Deno.test('stopping has no dedicated status text (the case is unreachable and was removed)', () => {
  assertEquals(buildStatusText('stopping', new Date()), 'Unknown')
})

Deno.test('containerInputToDeployment defaults memory/ephemeralStorage in decimal units matching create.ts', () => {
  const deployment = containerInputToDeployment({ name: 'app', namespace: 'ns', image: 'nginx:1.27' }) as Deployment
  const resources = deployment.spec?.template?.spec?.containers?.[0]?.resources
  assertEquals(resources?.limits?.memory?.serialize(), '256M')
  assertEquals(resources?.limits?.['ephemeral-storage']?.serialize(), '1G')
  assertEquals(resources?.requests?.memory?.serialize(), '256M')
  assertEquals(resources?.requests?.['ephemeral-storage']?.serialize(), '1G')
})

Deno.test('a scale-down to zero reports stopped even mid-rollout (replicas=0 wins over Progressing)', () => {
  const status: Deployment['status'] = {
    replicas: 0,
    readyReplicas: 0,
    availableReplicas: 0,
    unavailableReplicas: 0,
    conditions: [
      { type: 'Progressing', status: 'True', reason: 'NewReplicaSetCreated' },
    ],
  }
  assertEquals(mapDeploymentStatus(status), 'stopped')
})

Deno.test('a genuine scale-up (replicas>0) still reports starting', () => {
  const status: Deployment['status'] = {
    replicas: 2,
    readyReplicas: 0,
    availableReplicas: 0,
    unavailableReplicas: 0,
    conditions: [
      { type: 'Progressing', status: 'True', reason: 'NewReplicaSetCreated' },
    ],
  }
  assertEquals(mapDeploymentStatus(status), 'starting')
})

function podOwnedBy(podName: string, replicaSetName: string): Pod {
  return {
    metadata: {
      name: podName,
      ownerReferences: [
        { apiVersion: 'apps/v1', kind: 'ReplicaSet', name: replicaSetName, uid: 'uid' },
      ],
    },
    status: {},
  } as Pod
}

Deno.test('a deployment does not claim pods owned by a differently-named deployment sharing its prefix', () => {
  const deployment = containerInputToDeployment({ name: 'web', namespace: 'ns', image: 'nginx:1.27' }) as Deployment
  const pods = [
    podOwnedBy('web-abc123-xyz', 'web-abc123'),
    podOwnedBy('web-api-def456-xyz', 'web-api-def456'),
  ]
  const replicas = extractReplicas(deployment, pods)
  assertEquals(replicas.instances.map((i) => i.name), ['web-abc123-xyz'])
})
