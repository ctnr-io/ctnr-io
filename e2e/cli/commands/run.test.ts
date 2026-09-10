import { assert, assertEquals, assertStringIncludes } from '@std/assert'
import {
  assertSuccessOrAuthFailure,
  cleanupContainer,
  generateTestContainerName,
  isAuthenticated,
  loginWithEnvToken,
  runCliCommand,
} from '../test-runner.ts'

Deno.test('CLI - run command', async (t) => {
  if (isAuthenticated) await loginWithEnvToken()

  await t.step('should show help for run command', async () => {
    const result = await runCliCommand(['run', '--help'])

    assertEquals(result.code, 0)
    // Help text goes to stderr via console.warn (logger.info)
    const output = result.stdout + result.stderr
    assertStringIncludes(output, 'run')
    assertStringIncludes(output, 'Container image to run')
    assertStringIncludes(output, 'Name of the container')
  })

  await t.step('should fail when no image provided', async () => {
    const result = await runCliCommand(['run'])

    assert(!result.success)
    assert(result.code !== 0)
  })

  await t.step('should fail with invalid container name', async () => {
    const result = await runCliCommand([
      'run',
      '--name',
      'INVALID_NAME_WITH_CAPS',
      'busybox:1.35',
      '--command',
      'echo test',
    ])

    assert(!result.success)
    const output = result.stdout + result.stderr
    assert(
      output.includes('Pattern:') ||
        output.includes('invalid') ||
        output.includes('DNS-1123') ||
        result.code !== 0,
      'Should fail with invalid container name',
    )
  })

  await t.step('should run a simple container', async () => {
    const containerName = generateTestContainerName()

    try {
      const result = await runCliCommand([
        'run',
        '--name',
        containerName,
        '--detach',
        'busybox:1.35',
        '--command',
        'echo Hello from e2e test',
      ], { timeout: 30000 })

      assertSuccessOrAuthFailure(result, 'run simple container')
    } finally {
      await cleanupContainer(containerName)
    }
  })

  await t.step('should run container with environment variables', async () => {
    const containerName = generateTestContainerName()

    try {
      const result = await runCliCommand([
        'run',
        '--name',
        containerName,
        '--detach',
        '--env',
        'TEST_VAR=hello_world',
        '--env',
        'ANOTHER_VAR=test_value',
        'busybox:1.35',
        '--command',
        "sh -c 'echo $TEST_VAR && echo $ANOTHER_VAR'",
      ], { timeout: 30000 })

      assertSuccessOrAuthFailure(result, 'run container with env vars')
    } finally {
      await cleanupContainer(containerName)
    }
  })

  await t.step('should run container with port exposure', async () => {
    const containerName = generateTestContainerName()

    try {
      const result = await runCliCommand([
        'run',
        '--name',
        containerName,
        '--detach',
        '--publish',
        '8080',
        'busybox:1.35',
        '--command',
        'sleep 10',
      ], { timeout: 30000 })

      assertSuccessOrAuthFailure(result, 'run container with port')
    } finally {
      await cleanupContainer(containerName)
    }
  })

  await t.step('should run container with force recreation flag', async () => {
    const containerName = generateTestContainerName()

    try {
      const result = await runCliCommand([
        'run',
        '--name',
        containerName,
        '--detach',
        '--force',
        'busybox:1.35',
        '--command',
        'echo forced recreation',
      ], { timeout: 30000 })

      assertSuccessOrAuthFailure(result, 'run container with force')
    } finally {
      await cleanupContainer(containerName)
    }
  })

  await t.step('should run container with interactive flag', async () => {
    const containerName = generateTestContainerName()

    try {
      const result = await runCliCommand([
        'run',
        '--name',
        containerName,
        '--interactive',
        '--detach',
        'busybox:1.35',
        '--command',
        'echo interactive test',
      ], { timeout: 30000 })

      assertSuccessOrAuthFailure(result, 'run interactive container')
    } finally {
      await cleanupContainer(containerName)
    }
  })

  await t.step('should run container with terminal flag', async () => {
    const containerName = generateTestContainerName()

    try {
      const result = await runCliCommand([
        'run',
        '--name',
        containerName,
        '--terminal',
        '--detach',
        'busybox:1.35',
        '--command',
        'echo terminal test',
      ], { timeout: 30000 })

      assertSuccessOrAuthFailure(result, 'run container with terminal flag')
    } finally {
      await cleanupContainer(containerName)
    }
  })

  await t.step('should run container with custom command', async () => {
    const containerName = generateTestContainerName()

    try {
      const result = await runCliCommand([
        'run',
        '--name',
        containerName,
        '--detach',
        'busybox:1.35',
        '--command',
        "echo 'Custom command executed' && sleep 5",
      ], { timeout: 30000 })

      assertSuccessOrAuthFailure(result, 'run container with custom command')
    } finally {
      await cleanupContainer(containerName)
    }
  })
})
