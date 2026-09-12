import { assertEquals } from '@std/assert'
import type { Deployment } from '@cloudydeno/kubernetes-apis/apps/v1'
import { containerInputToDeployment, deploymentToContainer } from './container.ts'

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
