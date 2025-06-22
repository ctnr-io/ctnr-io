import { z } from "zod";
import kubernetes from "util/kube-client.ts";
import { Context, StdioContext } from "core/context.ts";
import { Pod } from "@cloudydeno/kubernetes-apis/core/v1";
import { WatchEvent } from "@cloudydeno/kubernetes-apis/common.ts";
import attach from "./attach.ts";
import { stdout } from "node:process";

export const meta = {
  aliases: {
    options: {
      "interactive": "i",
      "terminal": "t",
    },
  },
};

export const Input = z.object({
  name: z.string().describe("Name of the container"),
  image: z.string().describe("Container image to run"),
  env: z.array(z.string()).optional().describe("Set environment variables"),
  port: z.array(z.number()).optional().describe("port to expose"),
  interactive: z.boolean().optional().default(false).describe("Run interactively"),
  terminal: z.boolean().optional().default(false).describe("Run in a terminal"),
  force: z.boolean().optional().default(false).describe("Force recreate the container if it already exists"),
  // scaleType: z.enum(["concurrency", "rps", "cpu", "memory"]).optional().describe("Type of scaling to apply"),
  // scale: z.object({
  //   min: z.number().optional(),
  //   max: z.number().optional(),
  //   target: z.number().optional(),
  // }).optional().describe("Scaling configuration"),
  command: z.string().optional().describe("Command to run in the container"),
});

export type Input = z.infer<typeof Input>;

export default (context: StdioContext) => async (input: Input) => {
  const { name, image, env = [], port = [], interactive, terminal, force, command } = input;

  const podResource: Pod = {
    apiVersion: "v1",
    kind: "Pod",
    metadata: {
      name,
      namespace: "default",
      labels: {
        "ctnr.io/container": name,
      },
    },
    spec: {
      restartPolicy: "Never",
      // runtimeClassName: "gvisor",
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
          ports: port.length === 0 ? [] : port.map((p) => ({ containerPort: p })),
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
        },
      ],
      // resources: {
      //   limits: resources?.limits || {},
      //   requests: resources?.requests || {},
      // },
    },
  };

  const stdoutWriter = context.stdio.stdout.getWriter();
  const stderrWriter = context.stdio.stderr.getWriter();

  // Check if the pod already exists and is running
  const pod = await kubernetes.CoreV1.namespace("default").getPod(name).catch(() => null);
  if (pod) {
    if (pod.status?.phase === "Running" || pod.status?.phase === "Pending") {
      if (force) {
        stdoutWriter.write(`Container ${name} already exists and is ${pod.status.phase.toLowerCase()}. Forcing recreation...\r\n`);
      } else {
        stdoutWriter.write(`Container ${name} already exists and is running. Use --force to recreate it, or access it with \`attach\` command.\r\n`);
        stdoutWriter.releaseLock();
        stderrWriter.releaseLock();
        return;
      }
    } else {
      stdoutWriter.write(`Container ${name} already exists but is not running. Recreating it...\r\n`);
    }
    kubernetes.CoreV1.namespace("default").deletePod(name, {
      abortSignal: context.signal,
      gracePeriodSeconds: 0, // Force delete immediately
    });
    stdoutWriter.write(`Waiting for container ${name} to be deleted...\r\n`);
    // Wait for the pod to be deleted
    await waitPodEvent(context, name, "DELETED");
  }

  // Create the pod
  {
    kubernetes.CoreV1.namespace("default").createPod(podResource, {
      abortSignal: context.signal,
    });
    stdoutWriter.write(
      `Container ${name} created. Waiting for it to be ready...\r\n`,
    );
    // Watch for pod events
    await waitPodStatus(context, name, "ContainersReady").catch(() => {});
  }

  stdoutWriter.releaseLock();
  stderrWriter.releaseLock();

  // Attach to the pod if interactive or terminal mode is enabled
  await attach(context)({
    name,
    interactive,
    terminal,
  });
};

async function waitPodEvent(context: Context, name: string, eventType: WatchEvent<any, any>["type"]): Promise<void> {
  const podWatcher = await kubernetes.CoreV1.namespace("default").watchPodList({
    labelSelector: `ctnr.io/container=${name}`,
    abortSignal: context.signal,
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
  context: Context,
  name: string,
  status: "Initialized" | "Ready" | "ContainersReady" | "PodScheduled",
): Promise<void> {
  const podWatcher = await kubernetes.CoreV1.namespace("default").watchPodList({
    labelSelector: `ctnr.io/container=${name}`,
    abortSignal: context.signal,
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
