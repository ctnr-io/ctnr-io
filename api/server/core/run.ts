import { z } from "zod";
import { ServerContext } from "ctx/mod.ts";
import { Pod } from "@cloudydeno/kubernetes-apis/core/v1";
import { Quantity, WatchEvent } from "@cloudydeno/kubernetes-apis/common.ts";
import attach from "./attach.ts";
import { Expose, gatewayListeners, Port } from "./common.ts";

export const Meta = {
  aliases: {
    options: {
      "interactive": "i",
      "terminal": "t",
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
  env: z.array(
    z.string()
      .regex(/^[A-Z_][A-Z0-9_]*=.*$/, "Environment variables must follow format KEY=value with uppercase keys"),
  )
    .optional()
    .describe("Set environment variables"),
  port: z.array(Port).optional().describe("Expose ports in the container"),
  expose: z.array(Expose).optional().describe("Expose ports to the gateway"),
  interactive: z.boolean().optional().default(false).describe("Run interactively"),
  terminal: z.boolean().optional().default(false).describe("Run in a terminal"),
  detach: z.boolean().optional().default(false).describe("Detach from the container after starting"),
  force: z.boolean().optional().default(false).describe("Force recreate the container if it already exists"),
  // scaleType: z.enum(["concurrency", "rps", "cpu", "memory"]).optional().describe("Type of scaling to apply"),
  // scale: z.object({
  //   min: z.number().optional(),
  //   max: z.number().optional(),
  //   target: z.number().optional(),
  // }).optional().describe("Scaling configuration"),
  command: z.string()
    .max(1000, "Command length is limited for security reasons")
    .optional()
    .describe("Command to run in the container"),
});

export type Input = z.infer<typeof Input>;

export default async ({ ctx, input }: { ctx: ServerContext; input: Input }) => {
  const stderrWriter = ctx.stdio.stderr.getWriter();

  if (!ctx.auth.session) {
    stderrWriter.write("ERROR: You must be authenticated to run containers.\r\n");
    return;
  }
  if (!ctx.auth.user) {
    stderrWriter.write("ERROR: User is not available in the session.\r\n");
    return;
  }

  const { name, image, env = [], port, expose: exposePorts, interactive, terminal, detach, force, command } = input;

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
          ports: port,
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
              cpu: new Quantity(250, "m"), // 125 milliCPU (increased from 100m for better performance)
              memory: new Quantity(512, "M"), // 256 MiB (increased from 256Mi)
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
        stderrWriter.write(
          `Container ${name} already exists and is ${pod.status.phase.toLowerCase()}. Forcing recreation...\r\n`,
        );
      } else {
        stderrWriter.write(
          `Container ${name} already exists and is running. Use --force to recreate it.\r\n`,
        );
        stderrWriter.releaseLock();
        return;
      }
    } else {
      stderrWriter.write(`Container ${name} already exists but is not running. Recreating it...\r\n`);
    }
    stderrWriter.write(`Waiting for container ${name} to be deleted...\r\n`);
    await Promise.all([
      waitPodEvent(ctx, name, "DELETED"),
      ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).deletePod(name, {
        abortSignal: ctx.signal,
        gracePeriodSeconds: 0, // Force delete immediately
      }),
    ]);
  }

  // Create the pod
  stderrWriter.write(
    `Container ${name} created. Waiting for it to be ready...\r\n`,
  );
  ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).createPod(podResource, {
    abortSignal: ctx.signal,
  });
  pod = await waitForPod(ctx, name, (pod) => {
    switch (pod.status?.phase) {
      case "Succeeded": {
        stderrWriter.write(`Container ${name} completed successfully.\r\n`);
        return true;
      }
      case "Running":
        if (pod.status?.containerStatuses?.[0]?.ready) {
          return true;
        }
        if (pod.status?.containerStatuses?.[0]?.state?.terminated) {
          stderrWriter.write(
            `Container ${name} terminated with exit code ${
              pod.status.containerStatuses[0].state.terminated.exitCode
            }.\r\n`,
          );
          return true;
        }
        return false;
      default:
        return false;
    }
  });

  stderrWriter.releaseLock();

  if (exposePorts) {
    for (const port of exposePorts) {
      // Expose the port to the gateway
      try {
        await expose({
          ctx,
          input: {
            name,
            port: port.port,
            listener: port.name,
          },
        });
        console.debug(`Port ${port.port} exposed on listener ${port.name} for container ${name}.`);
      } catch (error) {
        console.error(`Failed to expose port ${port.port} on listener ${port.name} for container ${name}:`, error);
      }
    }
  }

  if (detach) {
    // If detach is enabled, just return without attaching
    console.debug(`Container ${name} is running. Detached successfully.`);
    return;
  } else if (pod?.status?.phase === "Running") {
    // Attach to the pod if interactive or terminal mode is enabled
    await attach({
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
};

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

async function waitPodStatus(
  ctx: ServerContext,
  name: string,
  status: "Initialized" | "Ready" | "ContainersReady" | "PodScheduled" | "PodCompleted" | "PodFailed" | "PodReady",
): Promise<void> {
  // TODO: Add timeout to prevent indefinite waiting
  // TODO: Add maximum retry attempts with exponential backoff
  // TODO: Implement circuit breaker pattern for failed pod status checks
  // TODO: Add logging for security monitoring and audit trails

  const podWatcher = await ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).watchPodList({
    labelSelector: `ctnr.io/name=${name}`,
    abortSignal: ctx.signal,
  });
  const reader = podWatcher.getReader();
  while (true) {
    const { done, value } = await reader.read();
    const pod = value?.object as Pod;
    if (pod.metadata?.name === name && pod.status?.conditions?.find((c) => c.type === status)?.status === "True") {
      console.debug(`Pod ${name} is in status: ${status}`);
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
