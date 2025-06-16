import { trpc } from "./trpc.ts";
import * as procedures from "./procedures.ts";

export const appRouter = trpc.router(procedures);

export type AppRouter = typeof appRouter;
