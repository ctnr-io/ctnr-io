import { assert, assertEquals, assertStringIncludes } from '@std/assert'
import {
  assertSuccessOrAuthFailure,
  generateTestContainerName,
  isAuthenticated,
  loginWithEnvToken,
  runCliCommand,
} from '../test-runner.ts'

Deno.test('CLI - stop command', async (t) => {
  if (isAuthenticated) await loginWithEnvToken()

  await t.step('should show help for stop command', async () => {
    const result = await runCliCommand(['stop', '--help'])

    assertEquals(result.code, 0)
    const output = result.stdout + result.stderr
    assertStringIncludes(output, 'stop')
  })

  await t.step('should fail when no container name provided', async () => {
    const result = await runCliCommand(['stop'])

    assert(!result.success)
    assert(result.code !== 0)
  })

  await t.step('should stop container (or fail gracefully)', async () => {
    const containerName = generateTestContainerName()

    const result = await runCliCommand([
      'stop',
      containerName,
    ], { timeout: 30000 })

    assertSuccessOrAuthFailure(result, 'stop container')
  })
})
