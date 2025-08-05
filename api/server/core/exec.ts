import { z } from "zod";
import { ServerContext } from "ctx/mod.ts";
import { ContainerName, ServerGenerator } from "./_common.ts";
import { setupSignalHandling, setupTerminalHandling, handleStreams, runWithCleanup } from "./_stream-utils.ts";

export const Meta = {
  aliases: {
    options: {
      interactive: "i",
      terminal: "t",
    },
  },
};

export const Input = z.object({
  name: ContainerName,
  command: z.string()
    .max(1000, "Command length is limited for security reasons")
    .optional()
    .default("/bin/sh")
    .describe("Command to execute in the container"),
  interactive: z.boolean().optional().default(false).describe("Run interactively"),
  terminal: z.boolean().optional().default(false).describe("Run in a terminal"),
});

export type Input = z.infer<typeof Input>;

export default async function* ({ ctx, input }: { ctx: ServerContext; input: Input }): ServerGenerator<Input> {
  yield* runWithCleanup(async function* (defer) {
    const { name, command = "/bin/sh", interactive = false, terminal = false } = input;

    // Check if the pod exists and is running
    const podResource = await ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).getPod(name);
    if (!podResource) {
      yield `Container ${name} not found.`;
      return;
    }
    
    if (podResource.status?.phase !== "Running") {
      yield `Container ${name} is not running (status: ${podResource.status?.phase}).`;
      return;
    }

    const tunnel = await ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).tunnelPodExec(name, {
      command: command === "/bin/sh" ? ["/bin/sh"] : ["sh", "-c", command],
      stdin: interactive,
      tty: terminal,
      stdout: true,
      stderr: true,
      abortSignal: ctx.signal,
      container: name,
    });

    setupSignalHandling(ctx, tunnel, terminal, interactive, defer);
    setupTerminalHandling(ctx, tunnel, terminal, interactive, defer);

    console.debug(`Executing command in container: ${name}`);
    yield `Executing command in container ${input.name}.`;
    if (interactive) {
      yield `Press ENTER if you don't see a command prompt.`;
    }

    defer.push(async () => {
      // Exit with the command's exit code
      ctx.stdio.exit(0);
    });

    await handleStreams(ctx, tunnel, interactive, terminal, defer);
  }, ctx);
}
