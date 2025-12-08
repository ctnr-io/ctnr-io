import { KubeConfig } from '@cloudydeno/kubernetes-apis/deps.ts'
import { CoreV1Api } from '@cloudydeno/kubernetes-apis/core/v1'
import { NetworkingV1NamespacedApi } from '@cloudydeno/kubernetes-apis/networking.k8s.io/v1'
import { AppsV1Api } from '@cloudydeno/kubernetes-apis/apps/v1'
import { RawKubeConfig } from '@cloudydeno/kubernetes-client/lib/kubeconfig.ts'
import { ApiextensionsV1Api } from '@cloudydeno/kubernetes-apis/apiextensions.k8s.io/v1'
import { AutoscalingV1Api } from '@cloudydeno/kubernetes-apis/autoscaling.k8s.io/v1'
import * as YAML from '@std/yaml'
import { SpdyEnabledRestClient } from './spdy-enabled-rest-client.ts'
import process from 'node:process'
import { DeleteOpts, GetListOpts, GetOpts, PatchOpts, PutOpts } from '@cloudydeno/kubernetes-apis/operations.ts'
import { HorizontalPodAutoscaler } from '../types/autoscaling.ts'
import {
  Certificate,
  ClusterPropagationPolicy,
  DNSEndpoint,
  FederatedResourceQuota,
  Gateway,
  HTTPRoute,
  IngressRoute,
  List,
  PodMetrics,
  PropagationPolicy,
  ReferenceGrant,
  TLSRoute,
} from '../types/mod.ts'

export type KubeClient = Awaited<ReturnType<typeof createKubeClient>>

const kubeconfig = process.env.KUBECONFIG || process.env.HOME + '/.kube/config'

export async function createKubeClient(context: 'karmada' | 'eu-1') {
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
          }) as Promise<PodMetrics>,
        getPodsListMetrics: (opts: Pick<GetListOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/metrics.k8s.io/v1beta1/namespaces/${namespace}/pods`,
            expectJson: true,
            ...opts,
          }) as Promise<List<PodMetrics>>,
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
          }) as Promise<IngressRoute>,
        createIngressRoute: (body: IngressRoute, opts?: Pick<PutOpts, 'abortSignal'>) =>
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
          }) as Promise<List<IngressRoute>>,
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
          }) as Promise<Gateway>,
        createGateway: (body: Gateway, opts?: Pick<PutOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'POST',
            path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/gateways`,
            bodyJson: body,
            ...opts,
          }),
        patchGateway: (name: string, body: Gateway, opts?: Pick<PatchOpts, 'abortSignal'>) =>
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
            expectJson: true,
            ...opts,
          }),
        getReferenceGrant: (name: string, opts?: Pick<GetOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/gateway.networking.k8s.io/v1beta1/namespaces/${namespace}/referencegrants/${name}`,
            expectJson: true,
            ...opts,
          }) as Promise<ReferenceGrant>,
        createReferenceGrant: (body: ReferenceGrant, opts?: Pick<PutOpts, 'abortSignal'>) =>
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
          }) as Promise<Certificate>,
        getCertificatesList: (opts?: Pick<GetListOpts, 'abortSignal'>): Promise<List<Certificate>> =>
          client.performRequest({
            method: 'GET',
            path: `/apis/cert-manager.io/v1/namespaces/${namespace}/certificates`,
            expectJson: true,
            ...opts,
          }) as Promise<List<Certificate>>,
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
          }) as Promise<PropagationPolicy>,
        getPropagationPolicyList: (opts?: Pick<GetListOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/policy.karmada.io/v1alpha1/namespaces/${namespace}/propagationpolicies`,
            expectJson: true,
            ...opts,
          }) as Promise<List<PropagationPolicy>>,
        createPropagationPolicy: (body: PropagationPolicy, opts?: Pick<PutOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'POST',
            path: `/apis/policy.karmada.io/v1alpha1/namespaces/${namespace}/propagationpolicies`,
            bodyJson: body,
            ...opts,
          }),
        patchPropagationPolicy: (name: string, body: any, opts?: Pick<PatchOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'PATCH',
            path: `/apis/policy.karmada.io/v1alpha1/namespaces/${namespace}/propagationpolicies/${name}`,
            bodyJson: body,
            contentType: 'application/merge-patch+json',
            ...opts,
          }),
        deletePropagationPolicy: (name: string, opts?: Pick<DeleteOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'DELETE',
            path: `/apis/policy.karmada.io/v1alpha1/namespaces/${namespace}/propagationpolicies/${name}`,
            ...opts,
          }),

        getClusterPropagationPolicy: (name: string, opts?: Pick<GetOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/policy.karmada.io/v1alpha1/clusterpropagationpolicies/${name}`,
            expectJson: true,
            ...opts,
          }) as Promise<ClusterPropagationPolicy>,
        getClusterPropagationPolicyList: (opts?: Pick<GetListOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/policy.karmada.io/v1alpha1/clusterpropagationpolicies`,
            expectJson: true,
            ...opts,
          }) as Promise<List<ClusterPropagationPolicy>>,
        createClusterPropagationPolicy: (body: ClusterPropagationPolicy, opts?: Pick<PutOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'POST',
            path: `/apis/policy.karmada.io/v1alpha1/clusterpropagationpolicies`,
            bodyJson: body,
            expectJson: false,
            ...opts,
          }),
        deleteClusterPropagationPolicy: (name: string, opts?: Pick<DeleteOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'DELETE',
            path: `/apis/policy.karmada.io/v1alpha1/clusterpropagationpolicies/${name}`,
            expectJson: true,
            ...opts,
          }),

        getFederatedResourceQuota: (name: string, opts?: Pick<GetOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/policy.karmada.io/v1alpha1/namespaces/${namespace}/federatedresourcequotas/${name}`,
            expectJson: true,
            ...opts,
          }) as Promise<FederatedResourceQuota>,
        getFederatedResourceQuotaList: (opts?: Pick<GetListOpts, 'abortSignal'>) =>
          client.performRequest({
            method: 'GET',
            path: `/apis/policy.karmada.io/v1alpha1/namespaces/${namespace}/federatedresourcequotas`,
            expectJson: true,
            ...opts,
          }) as Promise<List<FederatedResourceQuota>>,
        createFederatedResourceQuota: (
          body: FederatedResourceQuota,
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
