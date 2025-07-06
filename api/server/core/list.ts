import { z } from 'zod'
import { ServerContext } from "ctx/mod.ts";

export const Meta = {}

export const Input = z.tuple([])

export type Input = z.infer<typeof Input>

export default async ({ ctx, input }: { ctx: ServerContext; input: Input }) => {
	// List pods with label ctnr.io/container
	const pods = await ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).getPodList({
		labelSelector: "ctnr.io/name",
	});
	return pods.items.map((pod) => ({
		name: pod.metadata?.name,
		image: pod.spec?.containers[0].image,
		status: pod.status?.phase,
		createdAt: pod.metadata?.creationTimestamp,
	}));
}