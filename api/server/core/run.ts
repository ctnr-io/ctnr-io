import { z } from "zod";
import { ServerContext } from "ctx/mod.ts";
import { Pod } from "@cloudydeno/kubernetes-apis/core/v1";
import { Quantity, WatchEvent } from "@cloudydeno/kubernetes-apis/common.ts";
import attach from "./attach.ts";
import { ContainerName, Publish, ServerGenerator } from "./_common.ts";
import * as Route from "./route.ts";

export const Meta = {
  aliases: {
    options: {
      "interactive": "i",
      "terminal": "t",
      "publish": "p",
    },
  },
};

export const Input = z.object({
  name: ContainerName,
  image: z.string()
    .min(1, "Container image cannot be empty")
    // TODO: Add image tag validation when stricter security is needed
    // .regex(/^[a-zA-Z0-9._/-]+:[a-zA-Z0-9._-]+$/, "Container image must include a tag for security")
    // .refine((img) => !img.includes(":latest"), "Using ':latest' tag is not allowed for security reasons")
    .describe("Container image to run"),
  env: z.array(
    z.string()
      .regex(/^[A-Z_][A-Z0-9_]*=.*$/, "Environment variables must follow format KEY=value with uppercase keys"),
  )
    .optional()
    .describe("Set environment variables"),
  publish: z.array(Publish).optional().describe("Publish containers ports to the internal service"),
  route: z.union([z.boolean(), z.string().regex(/^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,})+$/)])
    .optional().describe("Route the container's published ports to a domain"),
  interactive: z.boolean().optional().default(false).describe("Run interactively"),
  terminal: z.boolean().optional().default(false).describe("Run in a terminal"),
  detach: z.boolean().optional().default(false).describe("Detach from the container after starting"),
  force: z.boolean().optional().default(false).describe("Force recreate the container if it already exists"),
  command: z.string()
    .max(1000, "Command length is limited for security reasons")
    .optional()
    .describe("Command to run in the container"),
});

export type Input = z.infer<typeof Input>;

export default async function* ({ ctx, input }: { ctx: ServerContext; input: Input }): ServerGenerator<Input> {
  const { name, image, env = [], publish, interactive, terminal, detach, force, command } = input;

  const podResource: Pod = {
    apiVersion: "v1",
    kind: "Pod",
    metadata: {
      name,
      namespace: ctx.kube.namespace,
      labels: {
        "ctnr.io/owner-id": ctx.auth.user.id,
        "ctnr.io/name": name,
      },
    },
    spec: {
      restartPolicy: "Never",
      // Enable gVisor runtime for additional container isolation
      // runtimeClassName: "gvisor", // Uncommented for enhanced security
      hostNetwork: false, // Do not use host network
      hostPID: false, // Do not share host PID namespace
      hostIPC: false, // Do not share host IPC namespace
      hostUsers: false, // Do not use host users, prevent root escalation
      automountServiceAccountToken: false, // Prevent user access to kubernetes API
      containers: [
        {
          name,
          image,
          stdin: interactive,
          tty: terminal,
          command: command ? ["sh", "-c", command] : undefined,
          env: env.length === 0 ? [] : env.map((e) => {
            const [name, value] = e.split("=");
            return { name, value };
          }),
          ports: publish?.map((p) => ({
            name: p.name,
            containerPort: Number(p.port),
            protocol: p.protocol?.toUpperCase() as "TCP" | "UDP",
          })),
          readinessProbe: {
            exec: {
              command: ["true"],
            },
          },
          livenessProbe: {
            exec: {
              command: ["true"],
            },
          },
          startupProbe: {
            exec: {
              command: ["true"],
            },
          },
          // Enhanced container-level security ctx
          securityContext: {
            allowPrivilegeEscalation: false, // Prevent privilege escalation
            privileged: false, // Explicitly disable privileged mode
            // readOnlyRootFilesystem: true, // Make root filesystem read-only
            // runAsNonRoot: true, // Ensure container runs as non-root
            // runAsUser: 65534, // Run as nobody user
            // runAsGroup: 65534, // Run as nobody group
            capabilities: {
              drop: ["ALL"], // Drop all capabilities
              // Add specific capabilities only if needed
              add: [
                "CHOWN",
                "DAC_OVERRIDE",
                "FOWNER",
                "FSETID",
                "KILL",
                "NET_BIND_SERVICE",
                "SETGID",
                "SETUID",
                "AUDIT_WRITE",
              ],
            },
          },
          // Enhanced resource limits to prevent resource exhaustion attacks
          resources: {
            limits: {
              // CPU & Memory are namespaced scoped
              // cpu: new Quantity(250, "m"), // 125 milliCPU (increased from 100m for better performance)
              // memory: new Quantity(512, "M"), // 256 MiB (increased from 256Mi)
              "ephemeral-storage": new Quantity(1, "G"), // Limit ephemeral storage
              // TODO: Add GPU limits when GPU resources are available
              // "nvidia.com/gpu": new Quantity(1, ""),
            },
            // requests: {
            //   cpu: new Quantity(100, "m"), // 100 milliCPU request
            //   memory: new Quantity(128, "Mi"), // 128 MiB request
            //   "ephemeral-storage": new Quantity(100, "Mi"), // Request ephemeral storage
            // },
          },
        },
      ],
      // TODO: Add topology spread constraints for better distribution
      // topologySpreadConstraints: [
      //   {
      //     maxSkew: 1,
      //     topologyKey: "ctx.kube.client.io/hostname",
      //     whenUnsatisfiable: "DoNotSchedule",
      //     labelSelector: {
      //       matchLabels: {
      //         "ctnr.io/name": name
      //       }
      //     }
      //   }
      // ],
      // Set DNS policy for better network security
      dnsPolicy: "ClusterFirst",
      // TODO: Configure custom DNS when needed for additional security
      // dnsConfig: {
      //   nameservers: ["8.8.8.8", "8.8.4.4"],
      //   searches: ["default.svc.cluster.local"],
      //   options: [
      //     {
      //       name: "ndots",
      //       value: "2"
      //     }
      //   ]
      // },
    },
  };

  // Check if the pod already exists and is running
  let pod = await ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).getPod(name).catch(() => null);
  if (pod) {
    if (pod.status?.phase === "Running" || pod.status?.phase === "Pending") {
      if (force) {
        yield `Container ${name} already exists. Forcing recreation...`;
      } else {
        yield `Container ${name} already exists and is running. Use --force to recreate it.`;
        return;
      }
    } else {
      yield `Container ${name} already exists but is not running. Recreating it...`;
      yield `Waiting for container ${name} to be deleted...`;
    }
    await Promise.all([
      waitPodEvent(ctx, name, "DELETED"),
      ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).deletePod(name, {
        abortSignal: ctx.signal,
        gracePeriodSeconds: 0, // Force delete immediately
      }),
    ]);
  }

  // Create the pod
  yield `Container ${name} created. Waiting for it to be ready...`;
  ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).createPod(podResource, {
    abortSignal: ctx.signal,
  });
  pod = await waitForPod(ctx, name, (pod) => {
    switch (pod.status?.phase) {
      case "Succeeded": {
        return true;
      }
      case "Running":
        if (pod.status?.containerStatuses?.[0]?.ready) {
          return true;
        }
        if (pod.status?.containerStatuses?.[0]?.state?.terminated) {
          return true;
        }
        return false;
      default:
        return false;
    }
  });
  if (!pod) {
    yield ({ input: { name } }) => console.warn(`Container ${name} failed to start.`);
    return;
  }
  if (pod.status?.phase === "Running") {
    yield ({ input: { name } }) => console.warn(`Container ${name} is running.`);
  }
  if (pod.status?.phase === "Succeeded") {
    yield ({ input: { name } }) => console.warn(`Container ${name} completed successfully.`);
    return;
  }
  if (pod.status?.containerStatuses?.[0]?.state?.terminated) {
    yield ({ input: { name } }) => console.warn(`Container ${name} terminated.`);
  }

  // Note: Service management is now handled by the route command
  // The --publish flag only affects container port configuration
  if (publish && publish.length > 0) {
    yield `Container ports are available for routing.`;

    if (input.route) {
      yield `Route container ports ${name}...`;
      // Route the container's published ports to a domain
      try {
        yield* Route.default({
          ctx,
          input: {
            name,
            port: publish.map((p) => p.name || p.port.toString()),
            domain: typeof input.route === "string" ? input.route : undefined,
          },
        });
      } catch (err) {
        console.error(`Failed to route container ${name}:`, err);
        yield `Failed to route container ${name}`;
      }
    }
  }

  if (detach) {
    // If detach is enabled, just return without attaching
    yield `Container ${name} is running. Detached successfully.`;
    return;
  } else if (pod?.status?.phase === "Running") {
    // Logs
    // Attach to the pod if interactive or terminal mode is enabled
    yield* attach({
      ctx,
      input: {
        name,
        interactive,
        terminal,
      },
    });
  } else {
    const logs = await ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).streamPodLog(name, {
      container: name,
      abortSignal: ctx.signal,
    });
    await logs.pipeTo(ctx.stdio.stdout, {
      signal: ctx.signal,
    });
  }
}

async function waitPodEvent(ctx: ServerContext, name: string, eventType: WatchEvent<any, any>["type"]): Promise<void> {
  // TODO: Add timeout to prevent indefinite waiting and potential DoS
  // TODO: Add rate limiting for watch operations
  // TODO: Implement exponential backoff for failed watch attempts
  // TODO: Add circuit breaker pattern for resilience

  const podWatcher = await ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).watchPodList({
    labelSelector: `ctnr.io/name=${name}`,
    abortSignal: ctx.signal,
  });
  const reader = podWatcher.getReader();
  while (true) {
    const { done, value } = await reader.read();
    const pod = value?.object as Pod;
    if (value?.type === eventType && pod?.metadata?.name === name) {
      console.debug(`Pod ${name} event: ${eventType}`);
      break;
    }
    if (done) {
      return;
    }
  }
}

async function waitForPod(
  ctx: ServerContext,
  name: string,
  predicate: (pod: Pod) => boolean | Promise<boolean>,
): Promise<Pod> {
  const podWatcher = await ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).watchPodList({
    labelSelector: `ctnr.io/name=${name}`,
    abortSignal: ctx.signal,
  });
  const reader = podWatcher.getReader();
  while (true) {
    const { done, value } = await reader.read();
    const pod = value?.object as Pod;
    if (await predicate(pod)) {
      return pod;
    }
    if (done) {
      return pod;
    }
  }
}
