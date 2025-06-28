import { trpc } from "../trpc.ts";

import * as SetSession from "api/auth/set-session.ts";

export const setSession = trpc.procedure
  .meta(SetSession.meta)
  .input(SetSession.Input)
  .mutation(async function ({ input, ctx }) {
    return await SetSession.default(ctx)(input);
  });