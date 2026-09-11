import { assert, assertEquals, assertStringIncludes } from '@std/assert'
import { runCliCommand } from './test-runner.ts'

// Representative catalog fixtures: real docker-compose.yml files shipped in the repo,
// covering a single-service stack, a multi-service stack, and a depends_on chain.
const catalogFixtures: { path: string; services: string[] }[] = [
  { path: 'catalog/ghost/docker-compose.yaml', services: ['ghost', 'db'] },
  { path: 'catalog/n8n/docker-compose.yaml', services: ['n8n'] },
  { path: 'catalog/postgres/docker-compose.yaml', services: ['postgres'] },
  { path: 'catalog/supabase/docker-compose.yaml', services: ['db', 'rest', 'auth'] },
]

Deno.test('Core API - Compose Command Tests', async (t) => {
  for (const fixture of catalogFixtures) {
    await t.step(`should map ${fixture.path} to a stack (json output)`, async () => {
      const result = await runCliCommand(['compose', fixture.path, '--output', 'json'])

      assertEquals(result.code, 0, `stderr: ${result.stderr}`)
      for (const service of fixture.services) {
        assertStringIncludes(result.stdout, service)
      }
    })
  }

  // Regression guard: `ctnr compose` is documented as a local/offline command (no cluster
  // round-trip), so it must not require Zitadel auth config. Without this, CLI bootstrap
  // eagerly resolved Zitadel config for every command and crashed here with
  // "ZITADEL_ISSUER and ZITADEL_CLIENT_ID environment variables are required".
  await t.step('should work without ZITADEL_ISSUER/ZITADEL_CLIENT_ID set', async () => {
    const result = await runCliCommand(['compose', 'catalog/ghost/docker-compose.yaml', '--output', 'json'], {
      env: { ZITADEL_ISSUER: '', ZITADEL_CLIENT_ID: '' },
    })

    assertEquals(result.code, 0, `stderr: ${result.stderr}`)
    assert(!result.stderr.includes('ZITADEL_ISSUER'))
  })
})
