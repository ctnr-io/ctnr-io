
import { z } from "zod";
import { ServerContext } from "../context.ts";

export const Meta = {};

export const Input = z.object({
	containers: z.object({
		vcpu: z.number().min(1).max(4).default(1),
		memory: z.number().min(128).max(65536).default(512),
	}),
	volumes: z.object({
		size: z.number().min(1).max(1000).default(10),
	}),
});
export type Input = z.infer<typeof Input>;

export default (ctx: ServerContext) => (input: Input) => {
};
