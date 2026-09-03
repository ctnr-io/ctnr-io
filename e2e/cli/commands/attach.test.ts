import { assert, assertEquals, assertStringIncludes } from '@std/assert'
import {
  assertSuccessOrAuthFailure,
  cleanupContainer,
  generateTestContainerName,
  isAuthenticated,
  loginWithEnvToken,
  runCliCommand,
} from '../test-runner.ts'

Deno.test('CLI - attach command', async (t) => {
  if (isAuthenticated) await loginWithEnvToken()

  await t.step('should show help for attach command', async () => {
    const result = await runCliCommand(['attach', '--help'])

    assertEquals(result.code, 0)
    // Help text goes to stderr via console.warn (logger.info)
    const output = result.stdout + result.stderr
    assertStringIncludes(output, 'attach')
    assertStringIncludes(output, 'Name of the container')
  })

  await t.step('should fail when no container name provided', async () => {
    const result = await runCliCommand(['attach'])

    assert(!result.success)
    assert(result.code !== 0)
  })

  await t.step('should attach to container (or fail gracefully)', async () => {
    const containerName = generateTestContainerName()

    try {
      const result = await runCliCommand([
        'attach',
        containerName,
      ], { timeout: 10000 })

      assertSuccessOrAuthFailure(result, 'attach to container')
    } finally {
      await cleanupContainer(containerName)
    }
  })

  await t.step('should attach with interactive flag', async () => {
    const containerName = generateTestContainerName()

    try {
      const result = await runCliCommand([
        'attach',
        containerName,
        '--interactive',
      ], {
        timeout: 10000,
        input: "echo 'Hello from interactive session'\nexit\n",
      })

      assertSuccessOrAuthFailure(result, 'attach with interactive flag')
    } finally {
      await cleanupContainer(containerName)
    }
  })

  await t.step('should attach with terminal flag', async () => {
    const containerName = generateTestContainerName()

    try {
      const result = await runCliCommand([
        'attach',
        containerName,
        '--terminal',
      ], { timeout: 10000 })

      assertSuccessOrAuthFailure(result, 'attach with terminal flag')
    } finally {
      await cleanupContainer(containerName)
    }
  })
})
