import { z } from "zod";
import { ServerContext } from "ctx/mod.ts";
import { Service } from "@cloudydeno/kubernetes-apis/core/v1";
import { gatewayListeners, Port } from "./common.ts";
import { yaml } from "@tmpl/core";
import { match } from "ts-pattern";
import { hash } from "node:crypto";

export const Meta = {
  aliases: {
    options: {
    },
  },
};

export const Input = z.object({
  name: z.string()
    .min(1, "Container name cannot be empty")
    .max(63, "Container name cannot exceed 63 characters")
    .regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, "Container name must be valid DNS-1123 label")
    .describe("Name of the container"),
  image: z.string()
    .min(1, "Container image cannot be empty")
    // TODO: Add image tag validation when stricter security is needed
    // .regex(/^[a-zA-Z0-9._/-]+:[a-zA-Z0-9._-]+$/, "Container image must include a tag for security")
    // .refine((img) => !img.includes(":latest"), "Using ':latest' tag is not allowed for security reasons")
    .describe("Container image to run"),
  port: Port,
  listener: z.enum(gatewayListeners).default("https"),
  hostname: z.string().optional().describe("Hostname to use for the exposed service"),
});

export type Input = z.infer<typeof Input>;

export default async ({ ctx, input }: { ctx: ServerContext; input: Input }) => {
  const stderrWriter = ctx.stdio.stderr.getWriter();

  const { name, port, listener, hostname } = input;

  // Get the pod the retrieve the opened ports
  const pod = await ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).getPod(name);
  if (!pod) {
    await stderrWriter.write(new TextEncoder().encode(`Container ${name} not found\n`));
    stderrWriter.releaseLock();
    return;
  }

  // Check if the pod is running
  if (pod.status?.phase !== "Running") {
    await stderrWriter.write(new TextEncoder().encode(`Container ${name} is not running\n`));
    stderrWriter.releaseLock();
    return;
  }

  // Check if the port is already exposed
  const containerPort = pod.spec?.containers[0].ports?.find((p) => p.containerPort === port.containerPort);
  if (!containerPort) {
    await stderrWriter.write(
      new TextEncoder().encode(`Port ${port.containerPort} is not exposed by container ${name}\n`),
    );
    stderrWriter.releaseLock();
    return;
  }

  // TODO: create service for the pod
  const service: Service = {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
			namespace: ctx.kube.namespace,
      name: `ctnr-user-host-service`,
      labels: {
				"ctnr.io/owner-id": ctx.auth.user.id,
      },
    },
    spec: {
      type: "ClusterIP",
      selector: {
				"ctnr.io/owner-id": ctx.auth.user.id, // Ensure the service is user-specific
      },
      ports: [
        {
          name: port.name,
          port: 0,
          protocol: "TCP", // Default to TCP for security
        },
      ],
    },
  };

  const userIdHash = hash(ctx.auth.user.id, "sha256");

  const route = match(listener).with("https", () =>
    yaml`
		apiVersion: gateway.networking.k8s.io/v1
		kind: HTTPRoute
		metadata:
		  namespace: ${ctx.kube.namespace}
			name: ${name}-${port.name}-httproute
		spec:
		  hostnames:
		  - "*.${userIdHash}.ctnr.io"
			${
      hostname
        ? yaml`
		  - "${hostname}"`
        : ""
    }
		  parentRefs:
		  - name: public-gateway
		    namespace: kube-public 
		    sectionName: https
		  rules:
		  - backendRefs:
		    - name: ctnr-user-host-service 
		      port: ${port.containerPort}
		`).otherwise(() => { throw new Error(`Unsupported listener: ${listener}`) });

  stderrWriter.releaseLock();
};
