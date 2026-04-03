import { assert, assertEquals, assertStringIncludes } from '@std/assert'
import { assertSuccessOrAuthFailure, isAuthenticated, loginWithEnvToken, runCliCommand } from '../test-runner.ts'

Deno.test('CLI - login command', async (t) => {
  await t.step('should show help for login command', async () => {
    const result = await runCliCommand(['login', '--help'])

    assertEquals(result.code, 0)
    const output = result.stdout + result.stderr
    assertStringIncludes(output, 'login')
  })

  await t.step('should login with token when CTNR_E2E_TOKEN is set', async () => {
    const token = Deno.env.get('CTNR_E2E_TOKEN')
    if (!token) {
      console.log('Skipping: CTNR_E2E_TOKEN not set')
      return
    }

    const result = await runCliCommand(['login', '--token', token])

    assertEquals(result.code, 0)
    const output = result.stdout + result.stderr
    assert(
      output.includes('Authenticated') || output.includes('✅'),
      `Expected success message, got: ${output}`,
    )
  })

  await t.step('should fail with invalid token', async () => {
    const result = await runCliCommand(['login', '--token', 'invalid-token'])

    assert(result.code !== 0)
  })
})
