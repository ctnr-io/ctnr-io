import { assertEquals, assertRejects } from '@std/assert'
import stopContainerHandler, { Input } from './stop.ts'

function fakeRequest(hpaError?: { httpCode: number }) {
  const calls: { patch?: unknown; deletedHpa?: string } = {}
  const request = {
    input: { name: 'web' },
    signal: new AbortController().signal,
    ctx: {
      project: { namespace: 'ns' },
      kube: {
        client: {
          karmada: {
            AppsV1: {
              namespace: () => ({
                patchDeployment: (name: string, _type: string, body: unknown) => {
                  calls.patch = { name, body }
                  return Promise.resolve()
                },
              }),
            },
            AutoScalingV2Api: {
              namespace: () => ({
                deleteHorizontalPodAutoscaler: (name: string) => {
                  calls.deletedHpa = name
                  return hpaError ? Promise.reject(hpaError) : Promise.resolve()
                },
              }),
            },
          },
        },
      },
    },
  }
  // deno-lint-ignore no-explicit-any
  return { request: request as any, calls }
}

async function drain(gen: AsyncGenerator<string, void>) {
  const out: string[] = []
  for await (const line of gen) out.push(line)
  return out
}

Deno.test('stop scales the deployment to 0 and deletes its HPA', async () => {
  const { request, calls } = fakeRequest()
  const out = await drain(stopContainerHandler(request))
  assertEquals(calls.patch, { name: 'web', body: { spec: { replicas: 0, template: {}, selector: {} } } })
  assertEquals(calls.deletedHpa, 'web')
  assertEquals(out, ['⏸️  Stopped containers web'])
})

Deno.test('stop tolerates a missing HPA (404)', async () => {
  const { request } = fakeRequest({ httpCode: 404 })
  assertEquals((await drain(stopContainerHandler(request))).length, 1)
})

Deno.test('stop surfaces a non-404 HPA delete error', async () => {
  const { request } = fakeRequest({ httpCode: 500 })
  await assertRejects(() => drain(stopContainerHandler(request)))
})

Deno.test('stop rejects a non DNS-1123 container name', () => {
  assertEquals(Input.safeParse({ name: 'Not Valid!' }).success, false)
})
