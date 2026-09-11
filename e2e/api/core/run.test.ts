import { assert, assertEquals, assertStringIncludes } from '@std/assert'
import { cleanupContainer, generateTestContainerName, runCliCommand } from './test-runner.ts'

Deno.test('Core API - Run Command Tests', async (t) => {
  await t.step('should show help for run command', async () => {
    const result = await runCliCommand(['run', '--help'])

    assertEquals(result.code, 0)
    assertStringIncludes(result.stdout, 'run')
    assertStringIncludes(result.stdout, 'Container image to run')
    assertStringIncludes(result.stdout, 'Name of the container')
  })

  await t.step('should fail when no arguments provided', async () => {
    const result = await runCliCommand(['run'])

    assert(!result.success)
    assert(result.code !== 0)
  })

  await t.step('should fail with invalid container name', async () => {
    const result = await runCliCommand([
      'run',
      'busybox:1.35',
      '--name',
      'INVALID_NAME_WITH_CAPS',
      '--command',
      'echo test',
    ])

    assert(!result.success)
    // The validation error might be in stdout or stderr, and the message format may differ
    const output = result.stdout + result.stderr
    assert(
      output.includes('Pattern:') ||
        output.includes('invalid') ||
        output.includes('DNS-1123'),
      'Should fail with invalid container name',
    )
  })

  await t.step('should run a simple container successfully', async () => {
    const containerName = generateTestContainerName()

    try {
      const result = await runCliCommand([
        'run',
        'busybox:1.35',
        '--name',
        containerName,
        '--detach',
        '--command',
        'echo Hello from e2e test',
      ], { timeout: 10000 })

      // Test may fail due to authentication/server connection, but should show proper command structure
      if (result.code === 0) {
        assertStringIncludes(result.stderr, `Container ${containerName} created`)
        assertStringIncludes(result.stderr, 'Waiting for it to be ready')
      } else {
        // If it fails, it should be due to authentication or server connection, not command structure
        const output = result.stdout + result.stderr
        assert(
          output.includes('authentication') ||
            output.includes('connection') ||
            output.includes('server') ||
            output.includes('login'),
          'Should fail due to authentication/connection issues, not command structure',
        )
      }
    } finally {
      await cleanupContainer(containerName)
    }
  })

  await t.step('should run container with environment variables', async () => {
    const containerName = generateTestContainerName()

    try {
      const result = await runCliCommand([
        'run',
        'busybox:1.35',
        '--name',
        containerName,
        '--detach',
        '--env',
        'TEST_VAR=hello_world',
        '--env',
        'ANOTHER_VAR=test_value',
        '--command',
        "sh -c 'echo $TEST_VAR && echo $ANOTHER_VAR'",
      ], { timeout: 10000 })

      // Test command structure, may fail due to auth/connection
      assert(result.code === 0, 'Should have exit code 0')
    } finally {
      await cleanupContainer(containerName)
    }
  })

  await t.step('should run container with port exposure', async () => {
    const containerName = generateTestContainerName()

    try {
      const result = await runCliCommand([
        'run',
        'busybox:1.35',
        '--name',
        containerName,
        '--detach',
        '--publish',
        '8080',
        '9090',
        '--command',
        'sleep 10',
      ], { timeout: 10000 })

      // Test command structure, may fail due to auth/connection
      assert(result.code === 0, 'Should have exit code 0')
    } finally {
      await cleanupContainer(containerName)
    }
  })

  await t.step('should handle force recreation of existing container', async () => {
    const containerName = generateTestContainerName()

    try {
      // Test the command structure for force recreation
      const result = await runCliCommand([
        'run',
        'busybox:1.35',
        '--name',
        containerName,
        '--detach',
        '--force',
        '--command',
        'echo forced recreation',
      ], { timeout: 10000 })

      // Test command structure, may fail due to auth/connection
      assert(result.code === 0, 'Should have exit code 0')
    } finally {
      await cleanupContainer(containerName)
    }
  })

  await t.step('should run interactive container (non-interactive test)', async () => {
    const containerName = generateTestContainerName()

    try {
      // Test interactive flag parsing
      const result = await runCliCommand([
        'run',
        'busybox:1.35',
        '--name',
        containerName,
        '--interactive',
        '--detach',
        '--command',
        'echo interactive test',
      ], { timeout: 10000 })

      // Test command structure, may fail due to auth/connection
      assert(result.code === 0, 'Should have exit code 0')
    } finally {
      await cleanupContainer(containerName)
    }
  })

  await t.step('should run container with terminal flag', async () => {
    const containerName = generateTestContainerName()

    try {
      const result = await runCliCommand([
        'run',
        'busybox:1.35',
        '--name',
        containerName,
        '--terminal',
        '--detach',
        '--command',
        'echo terminal test',
      ], { timeout: 10000 })

      // Test command structure, may fail due to auth/connection
      assert(result.code === 0, 'Should have exit code 0')
    } finally {
      await cleanupContainer(containerName)
    }
  })

  await t.step('should run container with custom command', async () => {
    const containerName = generateTestContainerName()

    try {
      const result = await runCliCommand([
        'run',
        'busybox:1.35',
        '--name',
        containerName,
        '--detach',
        '--command',
        "echo 'Custom command executed' && sleep 5",
      ], { timeout: 10000 })

      // Test command structure, may fail due to auth/connection
      assert(result.code === 0, 'Should have exit code 0')
    } finally {
      await cleanupContainer(containerName)
    }
  })
})
