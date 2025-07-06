import { z } from "zod";
import { ServerContext } from "ctx/mod.ts";
import { Service } from "@cloudydeno/kubernetes-apis/core/v1";

export const Meta = {
  aliases: {
    options: {
    },
  },
};

export const protocols = [
  "tcp",
  "udp",
  "http",
  "https",
  "grpc",
  "tls",
] as const;

export const Input = z.object({
  name: z.string().describe("Name of the container"),
  port: z.number().describe("Port to expose the service on"),
  protocol: z.enum(
    ...protocols,
  ),
  
});

export type Input = z.infer<typeof Input>;

export default ({ ctx, input }: { ctx: ServerContext; input: Input }) => {
  const service: Service = ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).service(input.name).catch((err) => null); 

};
