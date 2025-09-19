import { KubeConfig } from '@cloudydeno/kubernetes-apis/deps.ts'
import { CoreV1Api, Namespace, ResourceQuota, Service } from '@cloudydeno/kubernetes-apis/core/v1'
import { NetworkingV1NamespacedApi } from '@cloudydeno/kubernetes-apis/networking.k8s.io/v1'
import { AppsV1Api } from '@cloudydeno/kubernetes-apis/apps/v1'
import { RawKubeConfig } from '@cloudydeno/kubernetes-client/lib/kubeconfig.ts'
import { ApiextensionsV1Api } from '@cloudydeno/kubernetes-apis/apiextensions.k8s.io/v1'
import { AutoscalingV1Api } from '@cloudydeno/kubernetes-apis/autoscaling.k8s.io/v1'
import * as YAML from '@std/yaml'
import { SpdyEnabledRestClient } from './spdy-enabled-rest-client.ts'
import { match } from 'ts-pattern'
import { yaml } from '@tmpl/core'
import process from 'node:process'
import { DeleteOpts, GetListOpts, GetOpts, PatchOpts, PutOpts } from '@cloudydeno/kubernetes-apis/operations.ts'
import { FreeTier } from '../billing/utils.ts'
import { getNamespaceBalance } from '../billing/balance.ts'

const kubeconfig = process.env.KUBECONFIG || process.env.HOME + '/.kube/config'

export async function getKubeClient(context: 'karmada' | 'eu-0' | 'eu-1' | 'eu-2') {
  const decoder = new TextDecoder('utf-8')
  const kubeconfigFile = decoder.decode(await Deno.readFile(kubeconfig))
  const client = await SpdyEnabledRestClient.forKubeConfig(
    new KubeConfig(YAML.parse(kubeconfigFile.toString()) as RawKubeConfig) as any,
    context,
  )
  return {
    AutoScalingV2Api: {
      namespace: (namespace: string) => ({
        getHorizontalPodAutoscaler: (name: string, opts?: Pick<GetOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers/${name}`,
            expectJson: true,
            ...opts,
          }) as Promise<HorizontalPodAutoscaler>,
        createHorizontalPodAutoscaler: (body: HorizontalPodAutoscaler, opts?: Pick<PutOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'POST',
            path: `/apis/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers`,
            bodyJson: body,
            ...opts,
          }),
        patchHorizontalPodAutoscaler: (
          name: string,
          body: HorizontalPodAutoscaler,
          opts?: Pick<PatchOpts, 'abortSignal'>,
        ) =>
          client.performRequest({
            method: 'PATCH',
            path: `/apis/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers/${name}`,
            bodyJson: body,
            ...opts,
          }),
        deleteHorizontalPodAutoscaler: (name: string, opts?: Pick<DeleteOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'DELETE',
            path: `/apis/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers/${name}`,
            ...opts,
          }),
        listHorizontalPodAutoscalers: (opts?: Pick<GetListOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers`,
            expectJson: true,
            ...opts,
          }),
      }),
    },
    performRequest: client.performRequest.bind(client),
    get CoreV1() {
      return new CoreV1Api(client)
    },
    get AppsV1() {
      return new AppsV1Api(client)
    },
    NetworkingV1NamespacedApi(namespace: string) {
      return new NetworkingV1NamespacedApi(client, namespace)
    },
    get AutoscalingV1Api() {
      return new AutoscalingV1Api(client)
    },
    MetricsV1Beta1(namespace: string) {
      return {
        getPodMetrics: (name: string, opts: Pick<GetOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/metrics.k8s.io/v1beta1/namespaces/${namespace}/pods/${name}`,
            expectJson: true,
            ...opts,
          }) as Promise<MetricsV1Beta1Pods>,
        getPodsListMetrics: (opts: Pick<GetListOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/metrics.k8s.io/v1beta1/namespaces/${namespace}/pods`,
            expectJson: true,
            ...opts,
          }) as Promise<List<MetricsV1Beta1Pods>>,
      }
    },
    TraefikV1Alpha1(namespace: string) {
      return {
        getIngressRoute: (name: string, opts?: Pick<GetOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/traefik.io/v1alpha1/namespaces/${namespace}/ingressroutes/${name}`,
            expectJson: true,
            ...opts,
          }) as Promise<TraefikV1Alpha1IngressRoute>,
        createIngressRoute: (body: TraefikV1Alpha1IngressRoute, opts?: Pick<PutOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'POST',
            path: `/apis/traefik.io/v1alpha1/namespaces/${namespace}/ingressroutes`,
            bodyJson: body,
            ...opts,
          }),
        deleteIngressRoute: (name: string, opts?: Pick<DeleteOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'DELETE',
            path: `/apis/traefik.io/v1alpha1/namespaces/${namespace}/ingressroutes/${name}`,
            ...opts,
          }),
        listIngressRoutes: (opts?: Pick<GetListOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/traefik.io/v1alpha1/namespaces/${namespace}/ingressroutes`,
            expectJson: true,
            ...opts,
          }) as Promise<List<TraefikV1Alpha1IngressRoute>>,
      }
    },
    GatewayNetworkingV1(namespace: string) {
      return {
        getGateway: (name: string, opts?: Pick<GetOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/gateways/${name}`,
            expectJson: true,
            ...opts,
          }) as Promise<GatewayV1>,
        createGateway: (body: GatewayV1, opts?: Pick<PutOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'POST',
            path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/gateways`,
            bodyJson: body,
            ...opts,
          }),
        patchGateway: (name: string, body: GatewayV1, opts?: Pick<PatchOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'PATCH',
            path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/gateways/${name}`,
            bodyJson: body,
            contentType: 'application/merge-patch+json',
            ...opts,
          }),
        deleteGateway: (name: string, opts?: Pick<DeleteOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'DELETE',
            path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/gateways/${name}`,
            ...opts,
          }),
        getHTTPRoute: (name: string, opts?: Pick<GetOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/httproutes/${name}`,
            expectJson: true,
            ...opts,
          }) as Promise<HTTPRoute>,
        createHTTPRoute: (body: HTTPRoute, opts?: Pick<PutOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'POST',
            path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/httproutes`,
            bodyJson: body,
            ...opts,
          }),
        // patchHTTPRoute: (name: string, body: any) =>
        //   client.performRequest({
        //     method: "PATCH",
        //     path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/httproutes/${name}`,
        //     body,
        //   }),
        deleteHTTPRoute: (name: string, opts?: Pick<DeleteOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'DELETE',
            path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/httproutes/${name}`,
            ...opts,
          }),
        listHTTPRoutes: (opts?: Pick<GetListOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/httproutes`,
            ...opts,
          }),
        getReferenceGrant: (name: string, opts?: Pick<GetOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/gateway.networking.k8s.io/v1beta1/namespaces/${namespace}/referencegrants/${name}`,
            expectJson: true,
            ...opts,
          }) as Promise<GatewayV1Beta1ReferenceGrant>,
        createReferenceGrant: (body: GatewayV1Beta1ReferenceGrant, opts?: Pick<PutOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'POST',
            path: `/apis/gateway.networking.k8s.io/v1beta1/namespaces/${namespace}/referencegrants`,
            bodyJson: body,
            ...opts,
          }),
        deleteReferenceGrant: (name: string, opts?: Pick<DeleteOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'DELETE',
            path: `/apis/gateway.networking.k8s.io/v1beta1/namespaces/${namespace}/referencegrants/${name}`,
            ...opts,
          }),
      }
    },
    GatewayNetworkingV1Alpha2(namespace: string) {
      return {
        getTLSRoute: (name: string, opts?: Pick<GetOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/gateway.networking.k8s.io/v1alpha2/namespaces/${namespace}/tlsroutes/${name}`,
            expectJson: true,
            ...opts,
          }) as Promise<TLSRoute>,
        createTLSRoute: (body: any, opts?: Pick<PutOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'POST',
            path: `/apis/gateway.networking.k8s.io/v1alpha2/namespaces/${namespace}/tlsroutes`,
            bodyJson: body,
            ...opts,
          }),
        deleteTLSRoute: (name: string, opts?: Pick<DeleteOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'DELETE',
            path: `/apis/gateway.networking.k8s.io/v1alpha2/namespaces/${namespace}/tlsroutes/${name}`,
            ...opts,
          }),
      }
    },
    ExternalDNSV1alpha1(namespace: string) {
      return {
        getDNSEndpoint: (name: string, opts?: Pick<GetOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/externaldns.k8s.io/v1alpha1/namespaces/${namespace}/dnsendpoints/${name}`,
            expectJson: true,
            ...opts,
          }) as Promise<DNSEndpoint>,
        createDNSEndpoint: (body: DNSEndpoint, opts?: Pick<PutOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'POST',
            path: `/apis/externaldns.k8s.io/v1alpha1/namespaces/${namespace}/dnsendpoints`,
            bodyJson: body,
            ...opts,
          }),
        deleteDNSEndpoint: (name: string, opts?: Pick<DeleteOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'DELETE',
            path: `/apis/externaldns.k8s.io/v1alpha1/namespaces/${namespace}/dnsendpoints/${name}`,
            ...opts,
          }),
      }
    },
    CertManagerV1(namespace: string) {
      return {
        getCertificate: (name: string, opts?: Pick<GetOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/cert-manager.io/v1/namespaces/${namespace}/certificates/${name}`,
            expectJson: true,
            ...opts,
          }) as Promise<CertManagerV1Certificate>,
        getCertificatesList: (opts?: Pick<GetListOpts, 'abortSignal'>): Promise<List<CertManagerV1Certificate>> =>
          client.performRequest({
            method: 'GET',
            path: `/apis/cert-manager.io/v1/namespaces/${namespace}/certificates`,
            expectJson: true,
            ...opts,
          }) as Promise<List<CertManagerV1Certificate>>,
        createCertificate: (body: any, opts?: Pick<PutOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'POST',
            path: `/apis/cert-manager.io/v1/namespaces/${namespace}/certificates`,
            bodyJson: body,
            ...opts,
          }),
        deleteCertificate: (name: string, opts?: Pick<DeleteOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'DELETE',
            path: `/apis/cert-manager.io/v1/namespaces/${namespace}/certificates/${name}`,
            ...opts,
          }),
      }
    },
    get ApiextensionsV1Api() {
      return new ApiextensionsV1Api(client)
    },
    KarmadaV1Alpha1(namespace: string) {
      return {
        getPropagationPolicy: (name: string, opts?: Pick<GetOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/policy.karmada.io/v1alpha1/namespaces/${namespace}/propagationpolicies/${name}`,
            expectJson: true,
            ...opts,
          }) as Promise<KarmadaV1Alpha1PropagationPolicy>,
        getPropagationPolicyList: (opts?: Pick<GetListOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/policy.karmada.io/v1alpha1/namespaces/${namespace}/propagationpolicies`,
            expectJson: true,
            ...opts,
          }) as Promise<List<KarmadaV1Alpha1PropagationPolicy>>,
        createPropagationPolicy: (body: KarmadaV1Alpha1PropagationPolicy, opts?: Pick<PutOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'POST',
            path: `/apis/policy.karmada.io/v1alpha1/namespaces/${namespace}/propagationpolicies`,
            bodyJson: body,
            ...opts,
          }),
        deletePropagationPolicy: (name: string, opts?: Pick<DeleteOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'DELETE',
            path: `/apis/policy.karmada.io/v1alpha1/namespaces/${namespace}/propagationpolicies/${name}`,
            ...opts,
          }),

        getFederatedResourceQuota: (name: string, opts?: Pick<GetOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/policy.karmada.io/v1alpha1/namespaces/${namespace}/federatedresourcequotas/${name}`,
            expectJson: true,
            ...opts,
          }) as Promise<KarmadaV1Alpha1FederatedResourceQuota>,
        getFederatedResourceQuotaList: (opts?: Pick<GetListOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/policy.karmada.io/v1alpha1/namespaces/${namespace}/federatedresourcequotas`,
            expectJson: true,
            ...opts,
          }) as Promise<List<KarmadaV1Alpha1FederatedResourceQuota>>,
        createFederatedResourceQuota: (
          body: KarmadaV1Alpha1FederatedResourceQuota,
          opts?: Pick<PutOpts, 'abortSignal'>,
        ) =>
          client.performRequest({
            method: 'POST',
            path: `/apis/policy.karmada.io/v1alpha1/namespaces/${namespace}/federatedresourcequotas`,
            bodyJson: body,
            ...opts,
          }),
        deleteFederatedResourceQuota: (name: string, opts?: Pick<DeleteOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'DELETE',
            path: `/apis/policy.karmada.io/v1alpha1/namespaces/${namespace}/federatedresourcequotas/${name}`,
            ...opts,
          }),
      }
    },
  }
}

export type KubeClient = Awaited<ReturnType<typeof getKubeClient>>

export type List<T> = {
  apiVersion: string
  kind: string
  metadata: {
    resourceVersion: string
    selfLink: string
  }
  items: T[]
}

export type TraefikV1Alpha1IngressRoute = {
  apiVersion: 'traefik.io/v1alpha1'
  kind: 'IngressRoute'
  metadata: {
    name: string
    namespace: string
    labels?: Record<string, string>
  }
  spec: {
    entryPoints: string[]
    routes: Array<{
      match: string
      kind: string
      services: Array<{
        name: string
        port: number
      }>
    }>
    tls?: {
      certResolver?: string
      domains?: Array<{
        main: string
        sans: string[]
      }>
      secretName?: string
    }
  }
}

export type HTTPRoute = {
  apiVersion: 'gateway.networking.k8s.io/v1'
  kind: 'HTTPRoute'
  metadata: {
    namespace: string
    name: string
    labels?: Record<string, string>
  }
  spec: {
    hostnames: string[]
    parentRefs: Array<{
      name: string
      namespace: string
      sectionName: string
    }>
    rules: any[]
  }
}

export type MetricsV1Beta1Pods = {
  apiVersion: 'metrics.k8s.io/v1beta1'
  kind: 'PodMetrics'
  metadata: {
    name: string
    namespace: string
    labels?: Record<string, string>
    creationTimestamp: string
  }
  timestamp: string
  window: string
  containers: Array<{
    name: string
    usage: {
      cpu: string
      memory: string
    }
  }>
}

export type TLSRoute = {
  apiVersion: 'gateway.networking.k8s.io/v1alpha2'
  kind: 'TLSRoute'
  metadata: {
    namespace: string
    name: string
    labels?: Record<string, string>
  }
  spec: {
    hostnames: string[]
    parentRefs: Array<{
      name: string
      namespace: string
      sectionName: string
    }>
    rules: Array<{
      backendRefs: Array<{
        kind: string
        name: string
        port: number
      }>
    }>
  }
}

export type DNSEndpoint = {
  apiVersion: 'externaldns.k8s.io/v1alpha1'
  kind: 'DNSEndpoint'
  metadata: {
    name: string
    namespace: string
  }
  spec: {
    endpoints: Array<{
      dnsName: string
      recordTTL: number
      recordType: string
      targets: string[]
    }>
  }
}

export type CiliumNetworkPolicy = {
  apiVersion: 'cilium.io/v2'
  kind: 'CiliumNetworkPolicy'
  metadata: {
    name: string
    namespace: string
  }
  spec: {
    endpointSelector: {
      matchLabels: Record<string, string>
    }
    ingress: Array<{
      fromEndpoints?: Array<{
        matchLabels: Record<string, string>
      }>
      fromEntities?: string[]
    }>
    egress: Array<{
      toEndpoints?: Array<{
        matchLabels: Record<string, string>
      }>
      toEntities?: string[]
      toPorts?: Array<{
        ports: Array<{
          port: string
          protocol: string
        }>
        rules?: {
          dns?: Array<{ matchPattern: string }>
        }
      }>
    }>
  }
}

export type CertManagerV1Certificate = {
  apiVersion: 'cert-manager.io/v1'
  kind: 'Certificate'
  metadata: {
    name: string
    namespace: string
    labels?: Record<string, string>
  }
  spec: {
    secretName: string
    issuerRef: {
      name: string
      kind: string
    }
    commonName: string
    dnsNames: string[]
  }
}

export type GatewayV1 = {
  apiVersion: 'gateway.networking.k8s.io/v1'
  kind: 'Gateway'
  metadata: {
    name: string
    namespace: string
    labels?: Record<string, string>
  }
  spec: {
    gatewayClassName: string
    listeners: Array<{
      name: string
      port: number
      protocol: string
      tls?: {
        mode: string
        certificateRefs: Array<{
          name: string
          namespace?: string
          kind: string
        }>
      }
    }>
  }
}

export type GatewayV1Beta1ReferenceGrant = {
  apiVersion: 'gateway.networking.k8s.io/v1beta1'
  kind: 'ReferenceGrant'
  metadata: {
    name: string
    namespace: string
  }
  spec: {
    from: Array<{
      group: string
      kind: string
      name: string
      namespace?: string
    }>
    to: Array<{
      group: string
      kind: string
      name: string
      namespace?: string
    }>
  }
}

export type KarmadaV1Alpha1PropagationPolicy = {
  apiVersion: 'policy.karmada.io/v1alpha1'
  kind: 'PropagationPolicy'
  metadata: {
    name: string
    namespace: string
    labels: Record<string, string>
  }
  spec: {
    resourceSelectors: Array<{
      apiVersion?: string
      kind?: string
      name?: string
      namespace?: string
      labelSelector?: {
        matchLabels: Record<string, string>
      }
    }>
    placement: {
      clusterAffinity: {
        clusterNames: string[]
      }
    }
  }
}

export type KarmadaV1Alpha1FederatedResourceQuota = {
  apiVersion: 'policy.karmada.io/v1alpha1'
  kind: 'FederatedResourceQuota'
  metadata: {
    name: string
    namespace: string
    labels: Record<string, string>
  }
  spec: {
    overall: Partial<
      Record<
        | 'cpu'
        | 'memory'
        | 'storage'
        | 'ephemeral-storage'
        | 'requests.cpu'
        | 'requests.memory'
        | 'requests.storage'
        | 'requests.ephemeral-storage'
        | 'limits.cpu'
        | 'limits.memory'
        | 'limits.ephemeral-storage',
        string
      >
    >
  }
}

type HorizontalPodAutoscaler = {
  apiVersion: 'autoscaling/v2'
  kind: 'HorizontalPodAutoscaler'
  metadata: {
    name: string
    namespace: string
    labels?: Record<string, string>
  }
  spec: {
    scaleTargetRef: {
      apiVersion: string
      kind: string
      name: string
    }
    minReplicas: number
    maxReplicas: number
    metrics?: Array<{
      type: string
      resource?: {
        name: string
        target: {
          type: string
          averageUtilization?: number
          averageValue?: string
          value?: string
        }
      }
      pods?: {
        metricName: string
        target: {
          type: string
          averageUtilization?: number
          averageValue?: string
          value?: string
        }
      }
      object?: {
        describedObject: {
          apiVersion: string
          kind: string
          name: string
        }
        metricName: string
        target: {
          type: string
          averageUtilization?: number
          averageValue?: string
          value?: string
        }
      }
      external?: {
        metricName: string
        metricSelector?: {
          matchLabels: Record<string, string>
          matchExpressions?: Array<{
            key: string
            operator: string
            values: string[]
          }>
        }
        target: {
          type: string
          averageValue?: string
          value?: string
        }
      }
    }>
  }
}

export async function ensureHorizontalPodAutoscaler(
  kc: KubeClient,
  namespace: string,
  hpa: HorizontalPodAutoscaler,
  abortSignal: AbortSignal,
): Promise<void> {
  const hpaName = hpa.metadata.name
  await match(
    // Get the horizontal pod autoscaler and return null if it does not exist
    await kc.AutoScalingV2Api.namespace(namespace).getHorizontalPodAutoscaler(hpaName, { abortSignal }).catch(
      () => null,
    ),
  )
    // if horizontal pod autoscaler does not exist, create it
    .with(
      null,
      () => kc.AutoScalingV2Api.namespace(namespace).createHorizontalPodAutoscaler(hpa, { abortSignal }),
    )
    // if horizontal pod autoscaler exists, and match values, do nothing, else, patch it to ensure it match
    .with(hpa as any, () => true)
    .otherwise(async () => {
      console.debug('Replacing existing HorizontalPodAutoscaler', hpaName)
      // Delete the existing horizontal pod autoscaler first
      await kc.AutoScalingV2Api.namespace(namespace).deleteHorizontalPodAutoscaler(hpaName, { abortSignal })
      // Then create the new one
      return kc.AutoScalingV2Api.namespace(namespace).createHorizontalPodAutoscaler(hpa, { abortSignal })
    })
}

export async function ensureFederatedResourceQuota(
  kc: KubeClient,
  namespace: string,
  federatedResourceQuota: KarmadaV1Alpha1FederatedResourceQuota,
  abortSignal: AbortSignal,
): Promise<void> {
  const federatedResourceQuotaName = federatedResourceQuota.metadata.name
  await match(
    // Get the federated resource quota and return null if it does not exist
    await kc.KarmadaV1Alpha1(namespace).getFederatedResourceQuota(federatedResourceQuotaName, { abortSignal }).catch(
      () => null,
    ),
  )
    // if federated resource quota does not exist, create it
    .with(
      null,
      () => kc.KarmadaV1Alpha1(namespace).createFederatedResourceQuota(federatedResourceQuota, { abortSignal }),
    )
    // if federated resource quota exists, and match values, do nothing, else, patch it to ensure it match
    .with(federatedResourceQuota as any, () => true)
    .otherwise(async () => {
      console.debug('Replacing existing FederatedResourceQuota', federatedResourceQuotaName)
      // Delete the existing federated resource quota first
      await kc.KarmadaV1Alpha1(namespace).deleteFederatedResourceQuota(federatedResourceQuotaName, { abortSignal })
      // Then create the new one
      return kc.KarmadaV1Alpha1(namespace).createFederatedResourceQuota(federatedResourceQuota, { abortSignal })
    })
}

async function ensurePropagationPolicy(
  kc: KubeClient,
  namespace: string,
  propagationPolicy: KarmadaV1Alpha1PropagationPolicy,
  abortSignal: AbortSignal,
): Promise<void> {
  const propagationPolicyName = propagationPolicy.metadata.name
  await match(
    // Get the federated resource quota and return null if it does not exist
    await kc.KarmadaV1Alpha1(namespace).getPropagationPolicy(propagationPolicyName, { abortSignal }).catch(() => null),
  )
    // if federated resource quota does not exist, create it
    .with(null, () => kc.KarmadaV1Alpha1(namespace).createPropagationPolicy(propagationPolicy, { abortSignal }))
    // if federated resource quota exists, and match values, do nothing, else, patch it to ensure it match
    .with(propagationPolicy as any, () => true)
    .otherwise(async () => {
      // Delete the existing federated resource quota first
      await kc.KarmadaV1Alpha1(namespace).deletePropagationPolicy(propagationPolicyName, { abortSignal })
      // Then create the new one
      return kc.KarmadaV1Alpha1(namespace).createPropagationPolicy(propagationPolicy, { abortSignal })
    })
}

async function ensureNamespace(
  kc: KubeClient,
  namespaceObj: Namespace,
  abortSignal: AbortSignal,
): Promise<void> {
  const namespace = namespaceObj.metadata!.name!
  await match(
    // Get the namespace and return null if it does not exist
    await kc.CoreV1.getNamespace(namespace, { abortSignal }).catch(() => null),
  )
    // if namespace does not exist, create it
    .with(null, () => kc.CoreV1.createNamespace(namespaceObj, { abortSignal }))
    // if namespace exists, and match values, do nothing, else, patch it to ensure it match
    .with(namespace as any, () => true)
    .otherwise(() =>
      kc.CoreV1.patchNamespace(
        namespace,
        'apply-patch',
        namespaceObj,
        {
          fieldManager: 'ctnr.io',
          abortSignal,
        },
      )
    )
}

async function _ensureResourceQuota(
  kc: KubeClient,
  namespace: string,
  resourceQuota: ResourceQuota,
): Promise<void> {
  const resourceQuotaName = resourceQuota.metadata?.name!
  await match(
    // Get the resource quota and return null if it does not exist
    await kc.CoreV1.namespace(namespace).getResourceQuota(resourceQuotaName).catch(() => null),
  )
    // if resource quota does not exist, create it
    .with(null, () => kc.CoreV1.namespace(namespace).createResourceQuota(resourceQuota))
    // if resource quota exists, and match values, do nothing, else, replace it to ensure it match
    .with(resourceQuota as any, () => true)
    .otherwise(async () => {
      console.debug('Replacing existing ResourceQuota', resourceQuotaName)
      // Delete the existing resource quota first
      await kc.CoreV1.namespace(namespace).deleteResourceQuota(resourceQuotaName)
      // Then create the new one
      return kc.CoreV1.namespace(namespace).createResourceQuota(resourceQuota)
    })
}
async function ensureCiliumNetworkPolicy(
  kc: KubeClient,
  namespace: string,
  networkPolicy: CiliumNetworkPolicy,
  abortSignal: AbortSignal,
): Promise<void> {
  const networkPolicyName = networkPolicy.metadata.name
  await match(
    // Get the network policy and return null if it does not exist
    await kc.performRequest({
      method: 'GET',
      path: `/apis/cilium.io/v2/namespaces/${namespace}/ciliumnetworkpolicies/${networkPolicyName}`,
      expectJson: true,
      abortSignal,
    })
      .then((res) => res as any)
      .catch(() => null),
  )
    // if network policy does not exist, create it
    .with(null, () =>
      kc.performRequest({
        method: 'POST',
        path: `/apis/cilium.io/v2/namespaces/${namespace}/ciliumnetworkpolicies`,
        bodyJson: networkPolicy as any,
        expectJson: true,
        abortSignal,
      }))
    // if network policy exists, and match values, do nothing, else, replace it to ensure it match
    .with(networkPolicy, () => true)
    .otherwise(async () => {
      console.debug('Replacing existing CiliumNetworkPolicy', networkPolicyName)
      // Delete the existing network policy first
      console.log(
        await kc.performRequest({
          method: 'DELETE',
          path: `/apis/cilium.io/v2/namespaces/${namespace}/ciliumnetworkpolicies/${networkPolicyName}`,
          expectJson: true,
          abortSignal,
        }),
      )
      // Then create the new one
      return kc.performRequest({
        method: 'POST',
        path: `/apis/cilium.io/v2/namespaces/${namespace}/ciliumnetworkpolicies/${networkPolicyName}`,
        bodyJson: networkPolicy as any,
        expectJson: true,
        abortSignal,
      })
    })
}

export async function ensureService(
  kc: KubeClient,
  namespace: string,
  service: Service,
  abortSignal: AbortSignal,
): Promise<void> {
  // Get the service and return null if it does not exist
  const currentService = await kc.CoreV1.namespace(namespace).getService(service.metadata!.name!, { abortSignal })
    .catch(() => null)
  const nextService = service
  await match(
    currentService,
  )
    // if service does not exist, create it
    .with(null, () => kc.CoreV1.namespace(namespace).createService(service, { abortSignal }))
    // if service exists, and match values, do nothing,
    .with(nextService as any, () => true)
    .otherwise(async () => {
      await kc.CoreV1.namespace(namespace).deleteService(service.metadata!.name!, { abortSignal })
      await kc.CoreV1.namespace(namespace).createService(nextService, { abortSignal })
    })
}

export async function ensureIngressRoute(
  kc: KubeClient,
  namespace: string,
  ingressRoute: TraefikV1Alpha1IngressRoute,
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

export async function ensureDNSEndpoint(
  kc: KubeClient,
  namespace: string,
  dnsEndpoint: DNSEndpoint,
  abortSignal: AbortSignal,
): Promise<void> {
  // Ensure the dnsendpoint
  const currentDNSEndpoint = await kc.ExternalDNSV1alpha1(namespace).getDNSEndpoint(dnsEndpoint.metadata.name, {
    abortSignal,
  }).catch(
    () => null,
  )
  const nextDNSEndpoint = dnsEndpoint
  await match(
    currentDNSEndpoint,
  )
    // if dnsendpoint does not exist, create it
    .with(null, () => kc.ExternalDNSV1alpha1(namespace).createDNSEndpoint(nextDNSEndpoint as any, { abortSignal }))
    .with(nextDNSEndpoint as any, () => true)
    .otherwise(async () => {
      // else if the dnsendpoint doesn't have the same name, delete it and create a new one
      await kc.ExternalDNSV1alpha1(namespace).deleteDNSEndpoint(currentDNSEndpoint!.metadata.name, { abortSignal })
      await kc.ExternalDNSV1alpha1(namespace).createDNSEndpoint(nextDNSEndpoint as any, { abortSignal })
    })
}

export async function ensureCertManagerCertificate(
  kc: KubeClient,
  namespace: string,
  certificate: CertManagerV1Certificate,
  abortSignal: AbortSignal,
): Promise<void> {
  const currentCertificate = await kc.CertManagerV1(namespace).getCertificate(certificate.metadata.name, {
    abortSignal,
  }).catch(() => null)
  const nextCertificate = certificate
  await match(
    currentCertificate,
  )
    // if certificate does not exist, create it
    .with(null, () => kc.CertManagerV1(namespace).createCertificate(nextCertificate as any, { abortSignal }))
    // if certificate exists, and match values, do nothing,
    .with(nextCertificate as any, () => true)
    .otherwise(async () => {
      // else if the certificate doesn't have the same name, delete it and create a new one
      await kc.CertManagerV1(namespace).deleteCertificate(currentCertificate!.metadata.name, { abortSignal })
      await kc.CertManagerV1(namespace).createCertificate(nextCertificate as any, { abortSignal })
    })
}

async function _ensureGateway(
  kc: KubeClient,
  namespace: string,
  gateway: GatewayV1,
): Promise<void> {
  // Get the gateway and return null if it does not exist
  const currentGateway = await kc.GatewayNetworkingV1(namespace).getGateway(gateway.metadata.name).catch(() => null)
  await match(
    currentGateway,
  )
    // if gateway does not exist, create it
    .with(null, () => kc.GatewayNetworkingV1(namespace).createGateway(gateway))
    // if gateway exists, and match values, do nothing,
    .with(gateway as any, () => true)
    .otherwise(async () => {
      await kc.GatewayNetworkingV1(namespace).patchGateway(gateway.metadata.name, gateway)
    })
}

async function _ensureReferenceGrant(
  kc: KubeClient,
  namespace: string,
  referenceGrant: GatewayV1Beta1ReferenceGrant,
): Promise<void> {
  // Get the reference grant and return null if it does not exist
  const currentReferenceGrant = await kc.GatewayNetworkingV1(namespace).getReferenceGrant(referenceGrant.metadata.name)
    .catch(() => null)
  await match(
    currentReferenceGrant,
  )
    // if reference grant does not exist, create it
    .with(null, () => kc.GatewayNetworkingV1(namespace).createReferenceGrant(referenceGrant))
    // if reference grant exists, and match values, do nothing,
    .with(referenceGrant as any, () => true)
    .otherwise(async () => {
      await kc.GatewayNetworkingV1(namespace).deleteReferenceGrant(referenceGrant.metadata.name)
      await kc.GatewayNetworkingV1(namespace).createReferenceGrant(referenceGrant)
    })
}

export const ensureUserNamespace = async (
  kc: KubeClient,
  userId: string,
  abortSignal: AbortSignal,
): Promise<string> => {
  const namespace = 'ctnr-user-' + userId
  let namespaceObj: Namespace = {
    metadata: {
      name: namespace,
      labels: {
        'ctnr.io/owner-id': userId,
      },
    },
  }

  await ensureNamespace(kc, namespaceObj, abortSignal)

  namespaceObj = await kc.CoreV1.getNamespace(namespace, { abortSignal })

  const clusterNames = ['eu-0', 'eu-1', 'eu-2']

  const resources = [{
    apiVersion: 'v1',
    kind: 'Pod',
  }, {
    apiVersion: 'v1',
    kind: 'Service',
  }, {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
  }, {
    apiVersion: 'apps/v1',
    kind: 'StatefulSet',
  }, {
    apiVersion: 'apps/v1',
    kind: 'DaemonSet',
  }, {
    apiVersion: 'apps/v1',
    kind: 'ReplicaSet',
  }, {
    apiVersion: 'gateway.networking.k8s.io/v1',
    kind: 'HTTPRoute',
  }, {
    apiVersion: 'gateway.networking.k8s.io/v1beta1',
    kind: 'HTTPRoute',
  }, {
    apiVersion: 'cert-manager.io/v1',
    kind: 'Certificate',
  }, {
    apiVersion: 'traefik.io/v1alpha1',
    kind: 'IngressRoute',
  }, {
    apiVersion: 'autoscaling/v2',
    kind: 'HorizontalPodAutoscaler',
  }, {
    apiVersion: 'cilium.io/v2',
    kind: 'CiliumNetworkPolicy',
  }]

  const labelSelector = {
    matchLabels: {
      'cluster.ctnr.io/all': 'true',
    },
  }

  await ensurePropagationPolicy(kc, namespace, {
    apiVersion: 'policy.karmada.io/v1alpha1',
    kind: 'PropagationPolicy',
    metadata: {
      name: 'ctnr-user-propagation-policy-all',
      namespace: namespace,
      labels: {
        'ctnr.io/owner-id': userId,
      },
    },
    spec: {
      resourceSelectors: resources.map((resource) => ({
        ...resource,
        labelSelector,
      })),
      placement: {
        clusterAffinity: {
          clusterNames,
        },
      },
    },
  }, abortSignal)
  for (const clusterName of clusterNames) {
    const resources = [{
      apiVersion: 'v1',
      kind: 'Pod',
    }, {
      apiVersion: 'v1',
      kind: 'Service',
    }, {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
    }, {
      apiVersion: 'apps/v1',
      kind: 'StatefulSet',
    }, {
      apiVersion: 'apps/v1',
      kind: 'DaemonSet',
    }, {
      apiVersion: 'apps/v1',
      kind: 'ReplicaSet',
    }, {
      apiVersion: 'gateway.networking.k8s.io/v1',
      kind: 'HTTPRoute',
    }, {
      apiVersion: 'gateway.networking.k8s.io/v1beta1',
      kind: 'HTTPRoute',
    }, {
      apiVersion: 'cert-manager.io/v1',
      kind: 'Certificate',
    }, {
      apiVersion: 'traefik.io/v1alpha1',
      kind: 'IngressRoute',
    }, {
      apiVersion: 'autoscaling/v2',
      kind: 'HorizontalPodAutoscaler',
    }, {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
    }]
    const labelSelector = {
      matchLabels: {
        ['cluster.ctnr.io/' + clusterName]: 'true',
      },
    }
    await ensurePropagationPolicy(kc, namespace, {
      apiVersion: 'policy.karmada.io/v1alpha1',
      kind: 'PropagationPolicy',
      metadata: {
        name: 'ctnr-user-propagation-policy-' + clusterName,
        namespace: namespace,
        labels: {
          'ctnr.io/owner-id': userId,
        },
      },
      spec: {
        resourceSelectors: resources.map((resource) => ({
          ...resource,
          labelSelector,
        })),
        placement: {
          clusterAffinity: {
            clusterNames: [clusterName],
          },
        },
      },
    }, abortSignal)
  }

  // If credits-balance === 0, set limits to Free Tier
  const balance = getNamespaceBalance(namespaceObj)
  if (balance.credits === 0) {
    await ensureFederatedResourceQuota(kc, namespace, {
      apiVersion: 'policy.karmada.io/v1alpha1',
      kind: 'FederatedResourceQuota',
      metadata: {
        name: 'ctnr-resource-quota',
        namespace: namespace,
        labels: {
          'ctnr.io/owner-id': userId,
        },
      },
      spec: {
        overall: {
          'limits.cpu': FreeTier.cpu,
          'limits.memory': FreeTier.memory,
          'requests.storage': FreeTier.storage,
        },
      },
    }, abortSignal)
  }

  // Ensure the namespace has correct network policies
  const networkPolicyName = 'ctnr-user-network-policy'
  const networkPolicy = yaml`
    apiVersion: cilium.io/v2
    kind: CiliumNetworkPolicy
    metadata:
      name: ${networkPolicyName}
      namespace: ${namespace}
      labels:
        "ctnr.io/owner-id": ${userId}
        "cluster.ctnr.io/all": "true"
    spec:
      endpointSelector:
        matchLabels:
          "k8s:io.kubernetes.pod.namespace": ${namespace}
      ingress:
        # Allow from same namespace
        - fromEndpoints:
            - matchLabels:
                "k8s:io.kubernetes.pod.namespace": ${namespace}
        # Allow from ctnr-api
        - fromEndpoints:
            - matchLabels:
                "k8s:io.kubernetes.pod.namespace": ctnr-system
        # Allow from traefik
        - fromEndpoints:
            - matchLabels:
                "k8s:io.kubernetes.pod.namespace": traefik
        # Allow from external/public (outside cluster)
        - fromEntities:
            - world
      egress:
        # Allow to same namespace
        - toEndpoints:
            - matchLabels:
                "k8s:io.kubernetes.pod.namespace": ${namespace}
        # Allow DNS to kube-dns/CoreDNS in cluster
        - toEndpoints:
            - matchLabels:
                io.kubernetes.pod.namespace: kube-system
                k8s-app: kube-dns
          toPorts:
            - ports:
              - port: "53"
                protocol: TCP
              - port: "53"
                protocol: UDP
              rules:
                dns:
                  - matchPattern: "*"
        # Allow to traefik
        - toEndpoints:
            - matchLabels:
                "k8s:io.kubernetes.pod.namespace": traefik
        # Allow to external/public (outside cluster)
        - toEntities:
            - world
  `.parse<CiliumNetworkPolicy>(YAML.parse as any).data!
  console.log('Ensuring CiliumNetworkPolicy in namespace', namespace)
  await ensureCiliumNetworkPolicy(kc, namespace, networkPolicy, abortSignal)

  return namespace
}

export async function ensureUserRoute(
  kc: KubeClient,
  namespace: string,
  options: {
    userId: string
    name: string
    hostnames: string[]
    ports: Array<{ name: string; port: number }>
    clusters: string[]
  },
  abortSignal: AbortSignal,
): Promise<void> {
  const { userId, name, hostnames, ports, clusters } = options

  const clustersLabels = Object.fromEntries(clusters.map((cluster) => [
    `cluster.ctnr.io/${cluster}`,
    'true',
  ]))

  await ensureService(kc, namespace, {
    metadata: {
      name: name,
      namespace: namespace,
      labels: {
        'ctnr.io/owner-id': userId,
        ...clustersLabels,
      },
    },
    spec: {
      ports,
      selector: {
        'ctnr.io/owner-id': userId,
        'ctnr.io/name': name,
      },
    },
  }, abortSignal)

  // Create HTTPRoute for *-<user-id>.ctnr.io
  await ensureHTTPRoute(kc, namespace, {
    apiVersion: 'gateway.networking.k8s.io/v1',
    kind: 'HTTPRoute',
    metadata: {
      name: name,
      namespace: namespace,
      labels: {
        'ctnr.io/owner-id': userId,
        ...clustersLabels,
      },
    },
    spec: {
      hostnames: hostnames.filter((h) => h.endsWith('.ctnr.io')),
      parentRefs: [
        {
          name: 'public-gateway',
          namespace: 'kube-public',
          sectionName: 'web',
        },
        {
          name: 'public-gateway',
          namespace: 'kube-public',
          sectionName: 'websecure',
        },
      ],
      rules: [{
        // matches: [{ path: { type: "PathPrefix", value: "/" } }],
        backendRefs: ports.map((port) => ({
          kind: 'Service',
          name: name,
          port: port.port,
        })),
      }],
    },
  }, abortSignal)

  // Create IngressRoute and Certificate for each custom domain
  const tlds = hostnames
    .filter((h) => !h.endsWith('.ctnr.io'))
    .map((h) => h.split('.').slice(-2).join('.'))
    .filter((tld, index, self) => self.indexOf(tld) === index)

  for (const tld of tlds) {
    const hostnamesForTLD = hostnames.filter((h) => h.endsWith(`.${tld}`))
    await ensureCertManagerCertificate(kc, namespace, {
      apiVersion: 'cert-manager.io/v1',
      kind: 'Certificate',
      metadata: {
        name: tld,
        namespace: namespace,
        labels: {
          ...clustersLabels,
        },
      },
      spec: {
        secretName: tld,
        issuerRef: {
          name: 'letsencrypt',
          kind: 'ClusterIssuer',
        },
        commonName: hostnamesForTLD[0],
        dnsNames: hostnamesForTLD,
      },
    }, abortSignal)
    await ensureIngressRoute(kc, namespace, {
      apiVersion: 'traefik.io/v1alpha1',
      kind: 'IngressRoute',
      metadata: {
        name: tld,
        namespace: namespace,
        labels: {
          'ctnr.io/owner-id': userId,
          ...clustersLabels,
        },
      },
      spec: {
        entryPoints: ['web', 'websecure'],
        routes: hostnamesForTLD.map((hostname) => ({
          match: `Host("${hostname}")`,
          kind: 'Rule',
          services: ports.map((port) => ({
            name: name,
            port: port.port,
          })),
        })),
        tls: {
          secretName: tld,
        },
      },
    }, abortSignal)
  }
}
