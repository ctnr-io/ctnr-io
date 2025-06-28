import { initTRPC } from "@trpc/server";
import { ServerContext } from "api/context.ts";

export const trpc = initTRPC.context<ServerContext>().create();
// Create a new tRPC instance