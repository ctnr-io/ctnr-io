import { z } from "zod";
import { ServerContext } from "ctx/mod.ts";
import { ServerGenerator } from "./_common.ts";

export const Meta = {
  aliases: {
    options: {
      output: "o",
    },
  },
};

export const Input = z.object({
  output: z.enum(["wide", "name", "json", "yaml", 'raw']).optional(),
});

export type Input = z.infer<typeof Input>;

export default async function* ({ ctx, input }: { ctx: ServerContext; input: Input }): ServerGenerator<Input> {
  const { output = "wide" } = input;

  // List pods with label ctnr.io/name
  const pods = await ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).getPodList({
    labelSelector: "ctnr.io/name",
  });

  if (pods.items.length === 0) {
    yield "No containers found.";
    return;
  }

  // Transform pods to container data (hide Kubernetes internals)
  const containers = pods.items.map((pod) => {
    const containerStatus = pod.status?.containerStatuses?.[0];

    return {
      name: pod.metadata?.name || "",
      image: pod.spec?.containers[0]?.image || "",
      status: mapPodStatusToContainerStatus(pod.status?.phase?.toString(), containerStatus),
      created: formatAge(
        pod.metadata?.creationTimestamp?.toString(),
      ),
      ports: extractPorts(pod.spec?.containers[0]?.ports || undefined),
    };
  });

  switch (output) {
    case 'raw':
      yield containers;
      break;

    case "json":
      yield JSON.stringify(containers, null, 2);
      break;

    case "yaml":
      for (const container of containers) {
        yield `- name: ${container.name}`;
        yield `  image: ${container.image}`;
        yield `  status: ${container.status}`;
        yield `  created: ${container.created}`;
        if (container.ports) {
          yield `  ports: ${container.ports}`;
        } else {
          yield `  ports: []`;
        }
      }
      break;

    case "name":
      for (const container of containers) {
        yield container.name;
      }
      break;

    case "wide":
    default:
      // Header - Docker-like format
      yield "NAME".padEnd(26) +
        "IMAGE".padEnd(25) +
        "STATUS".padEnd(15) +
        "CREATED".padEnd(12) +
        "PORTS".padEnd(20);

      // Container rows
      for (const container of containers) {
        const name = container.name.padEnd(26);
        const image = container.image.padEnd(25);
        const status = container.status.padEnd(15);
        const created = container.created.padEnd(12);
        const ports = (container.ports.join(", ") || "").padEnd(20);

        yield name + image + status + created + ports;
      }
      break;
  }
}

function mapPodStatusToContainerStatus(phase?: string, containerStatus?: any): string {
  if (!phase) return "Unknown";

  switch (phase) {
    case "Running":
      return containerStatus?.ready ? "Up" : "Starting";
    case "Pending":
      return "Created";
    case "Succeeded":
      return "Exited (0)";
    case "Failed":
      return "Exited (1)";
    default:
      return phase;
  }
}

function extractPorts(ports?: any[]): string[] {
  if (!ports || ports.length === 0) return [];

  return ports
    .map((port) => `${port.containerPort}/${port.protocol?.toLowerCase() || "tcp"}`)
}

function formatAge(creationTimestamp?: string): string {
  if (!creationTimestamp) return "<unknown>";

  const created = new Date(creationTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}
