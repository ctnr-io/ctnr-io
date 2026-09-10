import { assert, assertEquals, assertStringIncludes } from '@std/assert'
import {
  assertSuccessOrAuthFailure,
  generateTestContainerName,
  isAuthenticated,
  loginWithEnvToken,
  runCliCommand,
} from '../test-runner.ts'

Deno.test('CLI - exec command', async (t) => {
  if (isAuthenticated) await loginWithEnvToken()

  await t.step('should show help for exec command', async () => {
    const result = await runCliCommand(['exec', '--help'])

    assertEquals(result.code, 0)
    const output = result.stdout + result.stderr
    assertStringIncludes(output, 'exec')
  })

  await t.step('should fail when no container name provided', async () => {
    const result = await runCliCommand(['exec'])

    assert(!result.success)
    assert(result.code !== 0)
  })

  await t.step('should exec in container (or fail gracefully)', async () => {
    const containerName = generateTestContainerName()

    const result = await runCliCommand([
      'exec',
      containerName,
      '--command',
      'echo hello',
    ], { timeout: 10000 })

    assertSuccessOrAuthFailure(result, 'exec in container')
  })

  await t.step('should exec with interactive flag', async () => {
    const containerName = generateTestContainerName()

    const result = await runCliCommand([
      'exec',
      containerName,
      '--command',
      '/bin/sh',
      '--interactive',
    ], {
      timeout: 10000,
      input: "echo 'exec test'\nexit\n",
    })

    assertSuccessOrAuthFailure(result, 'exec with interactive flag')
  })
})
