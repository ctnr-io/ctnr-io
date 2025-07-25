import { z } from "zod";
import { ServerContext } from "ctx/mod.ts";
import { ContainerName } from "./_common.ts";

export const Meta = {
  aliases: {
    options: {
      "follow": "f",
    },
  },
};

export const Input = z.object({
  name: ContainerName,
	follow: z.boolean().optional().default(false).describe("Follow the logs of the container"),
});

export type Input = z.infer<typeof Input>;

export default async ({ ctx, input }: { ctx: ServerContext; input: Input }) => {
  const logs = await ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).streamPodLog(name, {
    container: name,
    abortSignal: ctx.signal,
		follow: input.follow,
  });
  await logs.pipeTo(ctx.stdio.stdout, {
    signal: ctx.signal,
  });
};
