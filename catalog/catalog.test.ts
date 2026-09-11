import { assert, assertEquals } from '@std/assert'
import { parseComposeFile } from 'core/transform/compose.ts'

const CATALOG_APPS = ['n8n', 'postgres', 'ghost', 'supabase']

for (const app of CATALOG_APPS) {
  Deno.test(`catalog/${app}/docker-compose.yaml maps to a valid Stack`, async () => {
    const content = await Deno.readTextFile(`${import.meta.dirname}/${app}/docker-compose.yaml`)
    const stack = parseComposeFile(content, app)

    assertEquals(stack.name, app)
    assert(Object.keys(stack.services).length > 0, 'expected at least one service')
    for (const service of Object.values(stack.services)) {
      assert(service.image.length > 0, 'expected every service to have an image')
    }
  })
}
