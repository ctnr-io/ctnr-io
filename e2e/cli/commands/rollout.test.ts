import { assert, assertEquals, assertStringIncludes } from '@std/assert'
import {
  assertSuccessOrAuthFailure,
  generateTestContainerName,
  isAuthenticated,
  loginWithEnvToken,
  runCliCommand,
} from '../test-runner.ts'

Deno.test('CLI - rollout command', async (t) => {
  if (isAuthenticated) await loginWithEnvToken()

  await t.step('should show help for rollout command', async () => {
    const result = await runCliCommand(['rollout', '--help'])

    assertEquals(result.code, 0)
    const output = result.stdout + result.stderr
    assertStringIncludes(output, 'rollout')
  })

  await t.step('should fail when no container name provided', async () => {
    const result = await runCliCommand(['rollout'])

    assert(!result.success)
    assert(result.code !== 0)
  })

  await t.step('should rollout container image (or fail gracefully)', async () => {
    const containerName = generateTestContainerName()

    const result = await runCliCommand([
      'rollout',
      containerName,
      '--image',
      'busybox:1.35',
    ], { timeout: 30000 })

    assertSuccessOrAuthFailure(result, 'rollout container')
  })
})
