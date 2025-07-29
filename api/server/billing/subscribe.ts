import { z } from "zod";
import { ServerContext } from "ctx/mod.ts";

export const Meta = {};

export const Input = z.object({
  cpu: z.number().min(1).max(4).default(1),
  memory: z.number().min(128).max(65536).default(512),
  storage: z.number().min(1).max(20).default(10),
  "<storage-class-name>.storageclass.storage.k8s.io/requests.storage": z.string().default("standard"),
});
export type Input = z.infer<typeof Input>;

export default ({ ctx: _ctx }: { ctx: ServerContext }) => {
};
