import { assert } from '@std/assert'

export interface TestResult {
  success: boolean
  stdout: string
  stderr: string
  code: number
}

export async function runCliCommand(args: string[], options?: {
  input?: string
  timeout?: number
  env?: Record<string, string>
}): Promise<TestResult> {
  const timeout = options?.timeout ?? 10000
  const env = { ...Deno.env.toObject(), ...options?.env }

  const command = new Deno.Command('deno', {
    args: ['run', '-A', '--unstable-net', 'cli/main.ts', ...args],
    stdin: 'piped',
    stdout: 'piped',
    stderr: 'piped',
    env,
    cwd: '.',
  })

  const process = command.spawn()

  const timeoutId = setTimeout(() => {
    process.kill('SIGTERM')
  }, timeout)

  try {
    if (options?.input) {
      const writer = process.stdin.getWriter()
      await writer.write(new TextEncoder().encode(options.input))
      await writer.close()
    } else {
      await process.stdin.close()
    }

    const { success, code, stdout, stderr } = await process.output()

    clearTimeout(timeoutId)

    return {
      success,
      code,
      stdout: new TextDecoder().decode(stdout),
      stderr: new TextDecoder().decode(stderr),
    }
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

export function generateTestContainerName(): string {
  return `e2e-test-${Date.now()}-${Math.random().toString(36).substring(7)}`
}

export async function waitForCondition(
  condition: () => Promise<boolean>,
  timeout = 30000,
  interval = 1000,
): Promise<void> {
  const start = Date.now()

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  throw new Error(`Condition not met within ${timeout}ms`)
}

export async function cleanupContainer(name: string): Promise<void> {
  try {
    const result = await runCliCommand(['remove', name])
    console.log(`Cleanup attempt for ${name}: ${result.success ? 'success' : 'failed'}`)
  } catch (error) {
    console.log(`Cleanup error for ${name}:`, error)
  }
}

/**
 * Whether a CTNR_E2E_TOKEN is present, enabling full authenticated e2e tests.
 * When false, tests assert graceful auth/connection failure only.
 */
export const isAuthenticated = !!Deno.env.get('CTNR_E2E_TOKEN')

/**
 * Login with the e2e token from the environment. Must be called once per test suite
 * when CTNR_E2E_TOKEN is set.
 */
export async function loginWithEnvToken(): Promise<void> {
  const token = Deno.env.get('CTNR_E2E_TOKEN')
  if (!token) return
  const result = await runCliCommand(['login', '--token', token])
  if (result.code !== 0) {
    throw new Error(`Token login failed (code=${result.code}): ${result.stderr}`)
  }
}

/**
 * Assert that a command either succeeded (code=0) or failed gracefully due
 * to auth/connection issues (code=1 + expected error message).
 */
export function assertSuccessOrAuthFailure(result: TestResult, context?: string): void {
  if (result.code === 0) return
  const output = result.stdout + result.stderr
  assert(
    result.code === 1 && (
      output.includes('authentication') ||
      output.includes('connection') ||
      output.includes('server') ||
      output.includes('login') ||
      output.includes('Unable to connect') ||
      output.includes('401') ||
      output.includes('Unauthorized') ||
      output.includes('session')
    ),
    `${context ?? 'Command'} failed with unexpected error (code=${result.code}):\n${output}`,
  )
}
