/**
 * Execute kubectl apply command and return an async iterable of output lines
 * @param yamlContent YAML content to apply
 * @returns Async iterable of command output lines
 */
export async function* kubectlApply(yamlContent: string): AsyncIterable<string> {
  const command = new Deno.Command("sh", {
    args: ["-c", "kubectl apply -f -"],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  });

  const process = command.spawn();

  // Write YAML content to stdin
  const encoder = new TextEncoder();
  const stdinWriter = process.stdin.getWriter();
  await stdinWriter.write(encoder.encode(yamlContent));
  stdinWriter.close();

  // Create readers for stdout and stderr
  const stdoutReader = process.stdout.getReader();
  const stderrChunks: Uint8Array[] = [];

  // Read stderr in the background
  const stderrPromise = (async () => {
    const stderrReader = process.stderr.getReader();
    try {
      while (true) {
        const { done, value } = await stderrReader.read();
        if (done) break;
        stderrChunks.push(value);
      }
    } finally {
      stderrReader.releaseLock();
    }
  })();

  // Process stdout as an async iterable
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await stdoutReader.read();
      if (done) break;

      // Decode and split by lines
      const text = decoder.decode(value, { stream: true });
      const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");

      for (const line of lines) {
        yield line;
      }
    }
  } finally {
    stdoutReader.releaseLock();
  }

  // Wait for process to complete and check for errors
  const { code } = await process.status;
  await stderrPromise;

  if (code !== 0) {
    const errorMessage = decoder.decode(new Uint8Array(stderrChunks.flatMap((chunk) => [...chunk])));
    throw new Error(errorMessage);
  }
}
