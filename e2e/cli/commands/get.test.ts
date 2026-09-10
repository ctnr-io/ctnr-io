import { assert, assertEquals, assertStringIncludes } from '@std/assert'
import {
  assertSuccessOrAuthFailure,
  isAuthenticated,
  loginWithEnvToken,
  runCliCommand,
} from '../test-runner.ts'

Deno.test('CLI - get command', async (t) => {
  if (isAuthenticated) await loginWithEnvToken()

  await t.step('should show help for get command', async () => {
    const result = await runCliCommand(['get', '--help'])

    assertEquals(result.code, 0)
    const output = result.stdout + result.stderr
    assertStringIncludes(output, 'get')
  })

  await t.step('should fail when no container name provided', async () => {
    const result = await runCliCommand(['get'])

    assert(!result.success)
    assert(result.code !== 0)
  })

  await t.step('should get container details', async () => {
    const result = await runCliCommand(['get', 'non-existent-container'], { timeout: 30000 })

    assertSuccessOrAuthFailure(result, 'get container')
  })
})
