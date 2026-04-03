import { assert, assertEquals, assertStringIncludes } from '@std/assert'
import {
  assertSuccessOrAuthFailure,
  generateTestContainerName,
  isAuthenticated,
  loginWithEnvToken,
  runCliCommand,
} from '../test-runner.ts'

Deno.test('CLI - remove command', async (t) => {
  if (isAuthenticated) await loginWithEnvToken()

  await t.step('should show help for remove command', async () => {
    const result = await runCliCommand(['remove', '--help'])

    assertEquals(result.code, 0)
    const output = result.stdout + result.stderr
    assertStringIncludes(output, 'remove')
  })

  await t.step('should fail when no container name provided', async () => {
    const result = await runCliCommand(['remove'])

    assert(!result.success)
    assert(result.code !== 0)
  })

  await t.step('should remove container (or fail gracefully)', async () => {
    const containerName = generateTestContainerName()

    const result = await runCliCommand([
      'remove',
      containerName,
    ], { timeout: 30000 })

    assertSuccessOrAuthFailure(result, 'remove container')
  })

  await t.step('should remove container with force flag', async () => {
    const containerName = generateTestContainerName()

    const result = await runCliCommand([
      'remove',
      containerName,
      '--force',
    ], { timeout: 30000 })

    assertSuccessOrAuthFailure(result, 'remove container with force')
  })
})
