import { trpc } from "./trpc.ts";
import * as procedures from "./procedures.ts";

export const router = trpc.router(procedures);

export type Router = typeof router;
