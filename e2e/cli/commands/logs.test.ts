import { assert, assertEquals, assertStringIncludes } from '@std/assert'
import {
  assertSuccessOrAuthFailure,
  generateTestContainerName,
  isAuthenticated,
  loginWithEnvToken,
  runCliCommand,
} from '../test-runner.ts'

Deno.test('CLI - logs command', async (t) => {
  if (isAuthenticated) await loginWithEnvToken()

  await t.step('should show help for logs command', async () => {
    const result = await runCliCommand(['logs', '--help'])

    assertEquals(result.code, 0)
    const output = result.stdout + result.stderr
    assertStringIncludes(output, 'logs')
  })

  await t.step('should fail when no container name provided', async () => {
    const result = await runCliCommand(['logs'])

    assert(!result.success)
    assert(result.code !== 0)
  })

  await t.step('should get logs from container (or fail gracefully)', async () => {
    const containerName = generateTestContainerName()

    const result = await runCliCommand([
      'logs',
      containerName,
    ], { timeout: 15000 })

    assertSuccessOrAuthFailure(result, 'get logs')
  })

  await t.step('should get logs with tail flag', async () => {
    const containerName = generateTestContainerName()

    const result = await runCliCommand([
      'logs',
      containerName,
      '--tail',
      '10',
    ], { timeout: 15000 })

    assertSuccessOrAuthFailure(result, 'get logs with tail')
  })

  await t.step('should get logs with timestamps flag', async () => {
    const containerName = generateTestContainerName()

    const result = await runCliCommand([
      'logs',
      containerName,
      '--timestamps',
    ], { timeout: 15000 })

    assertSuccessOrAuthFailure(result, 'get logs with timestamps')
  })
})
