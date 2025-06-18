import { initTRPC } from "@trpc/server";
import { StdioContext } from "core/context.ts";

export const trpc = initTRPC.context<StdioContext>().create();
// Create a new tRPC instance