import { z } from "zod";
import { ServerContext } from "api/context.ts";
import { Session } from "@supabase/supabase-js";

export const meta = {};

export const Input = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  token_type: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string().optional(),
    aud: z.string().optional(),
    role: z.string().optional(),
    app_metadata: z.object({
      provider: z.string().optional(),
      provider_id: z.string().optional(),
    }).optional(),
    user_metadata: z.object({}).optional(),
  }),
});
export type Input = z.infer<typeof Input>;

export default (ctx: ServerContext) => (input: Input) => {
  // List pods with label ctnr.io/container
  ctx.auth.session = input as Session;
};
