import { assertEquals, assertStringIncludes } from '@std/assert'
import {
  assertSuccessOrAuthFailure,
  isAuthenticated,
  loginWithEnvToken,
  runCliCommand,
} from '../test-runner.ts'

Deno.test('CLI - list command', async (t) => {
  if (isAuthenticated) await loginWithEnvToken()

  await t.step('should show help for list command', async () => {
    const result = await runCliCommand(['list', '--help'])

    assertEquals(result.code, 0)
    // Help text goes to stderr via console.warn (logger.info)
    assertStringIncludes(result.stdout + result.stderr, 'list')
  })

  await t.step('should list containers', async () => {
    const result = await runCliCommand(['list'], { timeout: 30000 })

    assertSuccessOrAuthFailure(result, 'list containers')
  })

  await t.step('should list containers with wide output', async () => {
    const result = await runCliCommand(['list', '--output', 'wide'], { timeout: 30000 })

    assertSuccessOrAuthFailure(result, 'list containers wide')
  })

  await t.step('should list containers with json output', async () => {
    const result = await runCliCommand(['list', '--output', 'json'], { timeout: 30000 })

    assertSuccessOrAuthFailure(result, 'list containers json')
  })

  await t.step('should list containers with yaml output', async () => {
    const result = await runCliCommand(['list', '--output', 'yaml'], { timeout: 30000 })

    assertSuccessOrAuthFailure(result, 'list containers yaml')
  })
})
