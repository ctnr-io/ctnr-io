import { z } from 'zod'
import { Context, namespace } from "api/context.ts";
import kubernetes from "lib/kube-client.ts";

export const meta = {}

export const Input = z.tuple([])

export type Input = z.infer<typeof Input>

export default (context: Context) => async (input: Input) => {
	// List pods with label ctnr.io/container
	const pods = await kubernetes.CoreV1.namespace(namespace).getPodList({
		labelSelector: "ctnr.io/container",
	});
	return pods.items.map((pod) => ({
		name: pod.metadata?.name,
		image: pod.spec?.containers[0].image,
		status: pod.status?.phase,
		createdAt: pod.metadata?.creationTimestamp,
	}));
}
