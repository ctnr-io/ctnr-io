import { z } from "zod";
import { ServerContext } from "ctx/mod.ts";

export const Meta = {
  aliases: {
    options: {
    },
  },
};

export const Input = z.object({
  name: z.string().describe("Name of the container"),

});

export type Input = z.infer<typeof Input>;

export default ({ ctx, input }: { ctx: ServerContext; input: Input }) => {
};
