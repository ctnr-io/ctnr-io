import { match } from 'ts-pattern'
import { KubeClient } from 'infra/kubernetes/client/mod.ts'
import { TLSRoute } from 'infra/kubernetes/types/gateway.ts'

export async function ensureTLSRoute(
	kc: KubeClient,
	namespace: string,
	tlsRoute: TLSRoute,
	abortSignal: AbortSignal,
): Promise<void> {
	// Ensure the tlsroute
	const currentTLSRoute = await kc.GatewayNetworkingV1Alpha2(namespace).getTLSRoute(tlsRoute.metadata.name, {
		abortSignal,
	}).catch(() => null)
	const nextTLSRoute = tlsRoute
	await match(
		currentTLSRoute,
	)
		// if tlsroute does not exist, create it
		.with(null, () => kc.GatewayNetworkingV1Alpha2(namespace).createTLSRoute(nextTLSRoute as any, { abortSignal }))
		.with(nextTLSRoute as any, () => true)
		.otherwise(async () => {
			// else if the tlsroute doesn't have the same name, delete it and create a new one
			await kc.GatewayNetworkingV1Alpha2(namespace).deleteTLSRoute(currentTLSRoute!.metadata.name, { abortSignal })
			await kc.GatewayNetworkingV1Alpha2(namespace).createTLSRoute(nextTLSRoute as any, { abortSignal })
		})
}

export async function deleteTLSRoute(
	kc: KubeClient,
	namespace: string,
	name: string,
	abortSignal: AbortSignal,
): Promise<void> {
	await kc.GatewayNetworkingV1Alpha2(namespace).deleteTLSRoute(name, { abortSignal }).catch(() => null)
}