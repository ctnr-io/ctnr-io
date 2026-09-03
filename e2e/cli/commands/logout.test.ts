import { assertEquals, assertStringIncludes } from '@std/assert'
import { assertSuccessOrAuthFailure, runCliCommand } from '../test-runner.ts'

Deno.test('CLI - logout command', async (t) => {
  await t.step('should show help for logout command', async () => {
    const result = await runCliCommand(['logout', '--help'])

    assertEquals(result.code, 0)
    const output = result.stdout + result.stderr
    assertStringIncludes(output, 'logout')
  })

  await t.step('should complete logout (succeeds even when not logged in)', async () => {
    const result = await runCliCommand(['logout'])

    assertSuccessOrAuthFailure(result, 'logout')
  })
})
