import { z } from "zod";
import { ServerContext } from "api/context.ts";

export const Meta = {};

export const Input = z.void();
export type Input = z.infer<typeof Input>;

export default (ctx: ServerContext) => (input: Input) => {
	ctx.auth.session = null
};
