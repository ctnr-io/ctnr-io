import { z } from "zod";
import kubernetes from "util/kube-client.ts";
import { Context } from "core/context.ts";
import { Pod } from "@cloudydeno/kubernetes-apis/core/v1";
import { WatchEvent } from "@cloudydeno/kubernetes-apis/common.ts";
import attach from './attach.ts'

export const meta = {
  aliases: {
    options: {
      "interactive": "i",
      "terminal": "t",
    },
  },
};

export const Input = z.tuple([
  z.string().describe("Name of the container"),
  z.object({
    image: z.string().describe("Container image to run"),
    env: z.array(z.string()).optional().describe("Set environment variables"),
    port: z.array(z.number()).optional().describe("port to expose"),
    interactive: z.boolean().optional().default(false).describe("Run interactively"),
    terminal: z.boolean().optional().default(false).describe("Run in a terminal"),
    // scaleType: z.enum(["concurrency", "rps", "cpu", "memory"]).optional().describe("Type of scaling to apply"),
    // scale: z.object({
    //   min: z.number().optional(),
    //   max: z.number().optional(),
    //   target: z.number().optional(),
    // }).optional().describe("Scaling configuration"),
    command: z.string().optional().describe("Command to run in the container"),
  }),
]);

export type Input = z.infer<typeof Input>;

export default (context: Context) => async (input: Input) => {
  const [name, { image, env = [], port = [], interactive, terminal, command }] = input;

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

  // Delete existing pod if it exists
  {
    const pod = await kubernetes.CoreV1.namespace("default").getPod(name).catch(() => null);
    if (pod) {
      console.warn(`Container ${name} already exists. Deleting it before creating a new one.`);
      kubernetes.CoreV1.namespace("default").deletePod(name, {
        abortSignal: context.signal,
      });
      console.info(`Waiting for container ${name} to be deleted...`);
      // Wait for the pod to be deleted
      await waitPodEvent(context, name, "DELETED");
    }
  }

  // Create pod
  {
    kubernetes.CoreV1.namespace("default").createPod(podResource, {
      abortSignal: context.signal,
    });
    console.info(`Container ${name} created. Waiting for it to be ready...`);
    // Watch for pod events
    await waitPodStatus(context, name, "ContainersReady");
  }

  // Delete the pod if the context is aborted
  context.signal?.addEventListener("abort", async () => {
    // Delete the pod if the context is aborted
    kubernetes.CoreV1.namespace("default").deletePod(name, {
      abortSignal: context.signal,
    });
    // Wait for the pod to be deleted
    await waitPodEvent(context, name, "DELETED");
  });

  // Attach to the pod if interactive or terminal mode is enabled
  await attach(context)([name, {
    interactive,
    terminal,
  }])

  // Delete the pod
  {
    kubernetes.CoreV1.namespace("default").deletePod(name, {
      abortSignal: context.signal,
    });
    // Wait for the pod to be deleted
    await waitPodEvent(context, name, "DELETED");
  }
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
