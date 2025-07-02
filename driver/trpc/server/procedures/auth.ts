import { trpc } from "../trpc.ts";

import * as Login from "api/auth/login.ts";
import * as Logout from "api/auth/logout.ts";

export const login = trpc.procedure
  .meta(Login.Meta)
  .input(Login.Input)
  .mutation(({ input, ctx }) => Login.default(ctx)(input));

export const logout = trpc.procedure
  .meta(Logout.Meta)
  .input(Logout.Input)
  .mutation(({ input, ctx }) => Logout.default(ctx)(input));