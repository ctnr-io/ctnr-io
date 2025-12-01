import { match } from 'ts-pattern'
import { KubeClient } from 'infra/kubernetes/client/mod.ts'
import { HTTPRoute } from 'infra/kubernetes/types/gateway.ts'

export async function ensureHTTPRoute(
	kc: KubeClient,
	namespace: string,
	httpRoute: HTTPRoute,
	abortSignal: AbortSignal,
): Promise<void> {
	// Ensure the httproute
	const currentHttpRoute = await kc.GatewayNetworkingV1(namespace).getHTTPRoute(httpRoute.metadata.name, {
		abortSignal,
	})
		.then((res) => res as HTTPRoute)
		.catch(() => null)
	const nextHttpRoute = httpRoute
	await match(
		currentHttpRoute,
	)
		// if httproute does not exist, create it
		.with(null, () => kc.GatewayNetworkingV1(namespace).createHTTPRoute(nextHttpRoute as any, { abortSignal }))
		.with(nextHttpRoute as any, () => true)
		.otherwise(async () => {
			await kc.GatewayNetworkingV1(namespace).deleteHTTPRoute(currentHttpRoute!.metadata.name, { abortSignal })
			await kc.GatewayNetworkingV1(namespace).createHTTPRoute(nextHttpRoute as any, { abortSignal })
		})
}

export async function deleteHTTPRoute(
	kc: KubeClient,
	namespace: string,
	name: string,
	abortSignal: AbortSignal,
): Promise<void> {
	await kc.performRequest({
		method: 'DELETE',
		path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/httproutes/${name}`,
		expectJson: true,
		abortSignal,
	}).catch(() => null)
}