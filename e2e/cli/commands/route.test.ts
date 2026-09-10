import { assert, assertEquals, assertStringIncludes } from '@std/assert'
import {
  assertSuccessOrAuthFailure,
  generateTestContainerName,
  isAuthenticated,
  loginWithEnvToken,
  runCliCommand,
} from '../test-runner.ts'

Deno.test('CLI - route command', async (t) => {
  if (isAuthenticated) await loginWithEnvToken()

  await t.step('should show help for route command', async () => {
    const result = await runCliCommand(['route', '--help'])

    assertEquals(result.code, 0)
    const output = result.stdout + result.stderr
    assertStringIncludes(output, 'route')
  })

  await t.step('should fail when no container name provided', async () => {
    const result = await runCliCommand(['route'])

    assert(!result.success)
    assert(result.code !== 0)
  })

  await t.step('should route container port (or fail gracefully)', async () => {
    const containerName = generateTestContainerName()

    const result = await runCliCommand([
      'route',
      containerName,
      '--port',
      '8080',
    ], { timeout: 30000 })

    assertSuccessOrAuthFailure(result, 'route container')
  })
})
