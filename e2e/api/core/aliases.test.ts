import { assert, assertEquals, assertStringIncludes } from '@std/assert'
import { cleanupContainer, generateTestContainerName, runCliCommand } from './test-runner.ts'

Deno.test('Core API - Docker Alias Command Tests', async (t) => {
  // ── ps ──────────────────────────────────────────────────────────────────────

  await t.step('ps: should show help', async () => {
    const result = await runCliCommand(['ps', '--help'])

    assertEquals(result.code, 0)
    assertStringIncludes(result.stdout, 'ps')
  })

  await t.step('ps: should list containers (alias for list)', async () => {
    const result = await runCliCommand(['ps'])

    assert(result.code === 0, 'Should have exit code 0')
  })

  // ── inspect ─────────────────────────────────────────────────────────────────

  await t.step('inspect: should show help', async () => {
    const result = await runCliCommand(['inspect', '--help'])

    assertEquals(result.code, 0)
    assertStringIncludes(result.stdout, 'inspect')
  })

  await t.step('inspect: should fail when no container name provided', async () => {
    const result = await runCliCommand(['inspect'])

    assert(!result.success)
    assert(result.code !== 0)
  })

  await t.step('inspect: should fail for non-existent container', async () => {
    const result = await runCliCommand(['inspect', 'non-existent-container-12345'], { timeout: 10000 })

    assert(!result.success)
  })

  // ── rm ───────────────────────────────────────────────────────────────────────

  await t.step('rm: should show help', async () => {
    const result = await runCliCommand(['rm', '--help'])

    assertEquals(result.code, 0)
    assertStringIncludes(result.stdout, 'rm')
  })

  await t.step('rm: should fail when no container name provided', async () => {
    const result = await runCliCommand(['rm'])

    assert(!result.success)
    assert(result.code !== 0)
  })

  await t.step('rm: should fail for non-existent container', async () => {
    const result = await runCliCommand(['rm', 'non-existent-container-12345'], { timeout: 10000 })

    assert(!result.success)
  })

  // ── short flags: -d, -e, -v ─────────────────────────────────────────────────

  await t.step('run: -d flag should be accepted (alias for --detach)', async () => {
    const containerName = generateTestContainerName()

    try {
      const result = await runCliCommand([
        'run',
        '--name',
        containerName,
        '-d',
        'busybox:1.35',
        'echo short-detach-flag',
      ], { timeout: 10000 })

      // May fail due to auth/connection but should not fail due to flag parsing
      const output = result.stdout + result.stderr
      assert(
        result.code === 0 ||
          output.includes('authentication') ||
          output.includes('connection') ||
          output.includes('server') ||
          output.includes('login'),
        'Should fail only due to auth/connection, not flag parsing',
      )
    } finally {
      await cleanupContainer(containerName)
    }
  })

  await t.step('run: -e flag should be accepted (alias for --env)', async () => {
    const containerName = generateTestContainerName()

    try {
      const result = await runCliCommand([
        'run',
        '--name',
        containerName,
        '-d',
        '-e',
        'MY_VAR=hello',
        'busybox:1.35',
        'echo short-env-flag',
      ], { timeout: 10000 })

      const output = result.stdout + result.stderr
      assert(
        result.code === 0 ||
          output.includes('authentication') ||
          output.includes('connection') ||
          output.includes('server') ||
          output.includes('login'),
        'Should fail only due to auth/connection, not flag parsing',
      )
    } finally {
      await cleanupContainer(containerName)
    }
  })

  await t.step('run: -v flag should be accepted (alias for --volume)', async () => {
    const containerName = generateTestContainerName()

    try {
      const result = await runCliCommand([
        'run',
        '--name',
        containerName,
        '-d',
        '-v',
        'mydata:/app/data:1G',
        'busybox:1.35',
        'echo short-volume-flag',
      ], { timeout: 10000 })

      const output = result.stdout + result.stderr
      assert(
        result.code === 0 ||
          output.includes('authentication') ||
          output.includes('connection') ||
          output.includes('server') ||
          output.includes('login'),
        'Should fail only due to auth/connection, not flag parsing',
      )
    } finally {
      await cleanupContainer(containerName)
    }
  })

  await t.step('run: combined short flags -d -e -v should all be accepted', async () => {
    const containerName = generateTestContainerName()

    try {
      const result = await runCliCommand([
        'run',
        '--name',
        containerName,
        '-d',
        '-e',
        'PORT=8080',
        '-v',
        'data:/app/data:1G',
        'busybox:1.35',
        'echo combined-flags',
      ], { timeout: 10000 })

      const output = result.stdout + result.stderr
      assert(
        result.code === 0 ||
          output.includes('authentication') ||
          output.includes('connection') ||
          output.includes('server') ||
          output.includes('login'),
        'Should fail only due to auth/connection, not flag parsing',
      )
    } finally {
      await cleanupContainer(containerName)
    }
  })

  // ── Docker-style positional args ─────────────────────────────────────────────

  await t.step('run: IMAGE and COMMAND as positional args', async () => {
    const containerName = generateTestContainerName()

    try {
      const result = await runCliCommand([
        'run',
        '--name',
        containerName,
        '-d',
        'busybox:1.35',
        'echo positional-command',
      ], { timeout: 10000 })

      const output = result.stdout + result.stderr
      assert(
        result.code === 0 ||
          output.includes('authentication') ||
          output.includes('connection') ||
          output.includes('server') ||
          output.includes('login'),
        'Should fail only due to auth/connection, not argument parsing',
      )
    } finally {
      await cleanupContainer(containerName)
    }
  })

  await t.step('run: IMAGE without COMMAND as positional arg', async () => {
    const containerName = generateTestContainerName()

    try {
      const result = await runCliCommand([
        'run',
        '--name',
        containerName,
        '-d',
        'busybox:1.35',
      ], { timeout: 10000 })

      const output = result.stdout + result.stderr
      assert(
        result.code === 0 ||
          output.includes('authentication') ||
          output.includes('connection') ||
          output.includes('server') ||
          output.includes('login'),
        'Should fail only due to auth/connection, not argument parsing',
      )
    } finally {
      await cleanupContainer(containerName)
    }
  })

  await t.step('exec: CONTAINER and COMMAND as positional args', async () => {
    const result = await runCliCommand(['exec', 'non-existent-container-12345', '/bin/sh'], { timeout: 10000 })

    // Should fail due to container not existing, not due to argument parsing
    assert(!result.success)
    const output = result.stdout + result.stderr
    assert(
      !output.includes('Unknown option') && !output.includes('Unexpected argument'),
      'Should not fail due to argument parsing',
    )
  })

  await t.step('exec: CONTAINER without COMMAND defaults to /bin/sh', async () => {
    const result = await runCliCommand(['exec', 'non-existent-container-12345'], { timeout: 10000 })

    // Should fail due to container not existing, not due to missing command
    assert(!result.success)
    const output = result.stdout + result.stderr
    assert(
      !output.includes('Unknown option') && !output.includes('Unexpected argument'),
      'Should not fail due to argument parsing',
    )
  })
})
