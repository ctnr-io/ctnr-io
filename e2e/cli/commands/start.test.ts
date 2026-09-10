import { assert, assertEquals, assertStringIncludes } from '@std/assert'
import {
  assertSuccessOrAuthFailure,
  generateTestContainerName,
  isAuthenticated,
  loginWithEnvToken,
  runCliCommand,
} from '../test-runner.ts'

Deno.test('CLI - start command', async (t) => {
  if (isAuthenticated) await loginWithEnvToken()

  await t.step('should show help for start command', async () => {
    const result = await runCliCommand(['start', '--help'])

    assertEquals(result.code, 0)
    const output = result.stdout + result.stderr
    assertStringIncludes(output, 'start')
  })

  await t.step('should fail when no container name provided', async () => {
    const result = await runCliCommand(['start'])

    assert(!result.success)
    assert(result.code !== 0)
  })

  await t.step('should start container (or fail gracefully)', async () => {
    const containerName = generateTestContainerName()

    const result = await runCliCommand([
      'start',
      containerName,
    ], { timeout: 30000 })

    assertSuccessOrAuthFailure(result, 'start container')
  })
})
