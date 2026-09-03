import { assert, assertEquals, assertStringIncludes } from '@std/assert'
import {
  assertSuccessOrAuthFailure,
  generateTestContainerName,
  isAuthenticated,
  loginWithEnvToken,
  runCliCommand,
} from '../test-runner.ts'

Deno.test('CLI - restart command', async (t) => {
  if (isAuthenticated) await loginWithEnvToken()

  await t.step('should show help for restart command', async () => {
    const result = await runCliCommand(['restart', '--help'])

    assertEquals(result.code, 0)
    const output = result.stdout + result.stderr
    assertStringIncludes(output, 'restart')
  })

  await t.step('should fail when no container name provided', async () => {
    const result = await runCliCommand(['restart'])

    assert(!result.success)
    assert(result.code !== 0)
  })

  await t.step('should restart container (or fail gracefully)', async () => {
    const containerName = generateTestContainerName()

    const result = await runCliCommand([
      'restart',
      containerName,
    ], { timeout: 30000 })

    assertSuccessOrAuthFailure(result, 'restart container')
  })
})
