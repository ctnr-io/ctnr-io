import { trpc } from 'driver/trpc//server/trpc.ts';
import * as core from "./procedures/core.ts";
import * as auth from "./procedures/auth.ts";

export const router = trpc.router({
	core,
	auth 
});

export type ServerRouter = typeof router;
