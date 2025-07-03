import { assert, assertEquals, assertStringIncludes } from "@std/assert";

export interface TestResult {
  success: boolean;
  stdout: string;
  stderr: string;
  code: number;
}

export async function runCliCommand(args: string[], options?: {
  input?: string;
  timeout?: number;
  env?: Record<string, string>;
}): Promise<TestResult> {
  const timeout = options?.timeout ?? 30000;
  const env = { ...Deno.env.toObject(), ...options?.env };
  
  const command = new Deno.Command("deno", {
    args: ["run", "-A", "--unstable-net", "cli/main.ts", ...args],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
    env,
    cwd: "../ctnr",
  });

  const process = command.spawn();
  
  // Set up timeout
  const timeoutId = setTimeout(() => {
    process.kill("SIGTERM");
  }, timeout);

  try {
    // Send input if provided
    if (options?.input) {
      const writer = process.stdin.getWriter();
      await writer.write(new TextEncoder().encode(options.input));
      await writer.close();
    } else {
      await process.stdin.close();
    }

    const { success, code, stdout, stderr } = await process.output();
    
    clearTimeout(timeoutId);
    
    return {
      success,
      code,
      stdout: new TextDecoder().decode(stdout),
      stderr: new TextDecoder().decode(stderr),
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export function generateTestContainerName(): string {
  return `e2e-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

export async function waitForCondition(
  condition: () => Promise<boolean>,
  timeout = 30000,
  interval = 1000
): Promise<void> {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
}

export async function cleanupContainer(name: string): Promise<void> {
  try {
    // Try to remove the container if it exists
    const result = await runCliCommand(["run", "--name", name, "--force", "busybox:1.35", "echo", "cleanup"]);
    console.log(`Cleanup attempt for ${name}: ${result.success ? 'success' : 'failed'}`);
  } catch (error) {
    console.log(`Cleanup error for ${name}:`, error);
  }
}
