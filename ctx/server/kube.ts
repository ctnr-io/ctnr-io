import { ensureUserNamespace, getKubeClient } from "lib/kube-client.ts";
import { KubeContext } from "../mod.ts";

export async function createKubeServerContext(userId: string): Promise<KubeContext> {
	const kc = await getKubeClient();
	return {
		kube: {
			client: kc,
			namespace: await ensureUserNamespace(kc, userId), 
		}
	};
}