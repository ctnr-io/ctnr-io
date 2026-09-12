import { assert, assertEquals, assertStringIncludes } from '@std/assert'
import { runCliCommand } from './test-runner.ts'

// `compose up`/`compose down` act on the real cluster (create/remove containers per service),
// so unlike e2e/api/core/compose.test.ts (offline-only, PR-blocking), this file makes real
// round-trips and only runs in the non-PR-blocking e2e-api-core job (weekly/on-demand), where a
// live cluster is expected. It still tolerates a graceful auth/connection failure so it also
// passes without one, mirroring run.test.ts / list.test.ts / attach.test.ts / integration.test.ts.

const fixture = 'catalog/postgres/docker-compose.yaml'

function assertSucceededOrGracefullyFailed(result: { code: number; stdout: string; stderr: string }) {
  if (result.code === 0) return
  const output = result.stdout + result.stderr
  assert(
    output.includes('authentication') ||
      output.includes('connection') ||
      output.includes('server') ||
      output.includes('login'),
    `Should fail due to authentication/connection issues, not command structure: ${output}`,
  )
}

Deno.test('Core API - Compose Up/Down Command Tests', async (t) => {
  await t.step('should show help for compose up command', async () => {
    const result = await runCliCommand(['compose', 'up', '--help'])

    assertEquals(result.code, 0)
    assertStringIncludes(result.stdout.toLowerCase(), 'docker-compose')
  })

  await t.step('should show help for compose down command', async () => {
    const result = await runCliCommand(['compose', 'down', '--help'])

    assertEquals(result.code, 0)
    assertStringIncludes(result.stdout.toLowerCase(), 'docker-compose')
  })

  await t.step('should deploy a stack to the cluster (compose up)', async () => {
    const result = await runCliCommand(['compose', 'up', fixture], { timeout: 30000 })

    assertSucceededOrGracefullyFailed(result)
  })

  await t.step('should tear down a stack from the cluster (compose down)', async () => {
    const result = await runCliCommand(['compose', 'down', fixture], { timeout: 30000 })

    assertSucceededOrGracefullyFailed(result)
  })
})
