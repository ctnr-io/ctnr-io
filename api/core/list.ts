import { z } from 'zod'
import { namespace, ServerContext } from "api/context.ts";

export const Meta = {}

export const Input = z.tuple([])

export type Input = z.infer<typeof Input>

export default (ctx: ServerContext) => async (input: Input) => {
	// List pods with label ctnr.io/container
	const pods = await ctx.kube.client.CoreV1.namespace(namespace).getPodList({
		labelSelector: "ctnr.io/name",
	});
	return pods.items.map((pod) => ({
		name: pod.metadata?.name,
		image: pod.spec?.containers[0].image,
		status: pod.status?.phase,
		createdAt: pod.metadata?.creationTimestamp,
	}));
}