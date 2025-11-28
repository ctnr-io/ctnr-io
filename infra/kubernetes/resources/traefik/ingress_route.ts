import { match } from 'ts-pattern'
import { KubeClient,} from 'infra/kubernetes/client/mod.ts'
import { IngressRoute } from 'infra/kubernetes/types/traefik.ts'

export async function ensureIngressRoute(
	kc: KubeClient,
	namespace: string,
	ingressRoute: IngressRoute,
	abortSignal: AbortSignal,
): Promise<void> {
	// Ensure the ingress route
	const currentIngressRoute = await kc.TraefikV1Alpha1(namespace).getIngressRoute(ingressRoute.metadata.name, {
		abortSignal,
	}).catch(
		() => null,
	)
	const nextIngressRoute = ingressRoute
	await match(
		currentIngressRoute,
	)
		// if ingress route does not exist, create it
		.with(null, () => kc.TraefikV1Alpha1(namespace).createIngressRoute(nextIngressRoute as any, { abortSignal }))
		// if ingress route exists, and match values, do nothing,
		.with(nextIngressRoute as any, () => true)
		.otherwise(async () => {
			// else if the ingress route doesn't have the same name, delete it and create a new one
			await kc.TraefikV1Alpha1(namespace).deleteIngressRoute(currentIngressRoute!.metadata.name, { abortSignal })
			await kc.TraefikV1Alpha1(namespace).createIngressRoute(nextIngressRoute as any, { abortSignal })
		})
}

export async function deleteIngressRoute(
	kc: KubeClient,
	namespace: string,
	name: string,
	abortSignal: AbortSignal,
): Promise<void> {
	await kc.TraefikV1Alpha1(namespace).deleteIngressRoute(name, { abortSignal }).catch(() => null)
}
