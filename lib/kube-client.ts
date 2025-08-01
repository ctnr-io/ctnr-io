import { KubeConfig } from "@cloudydeno/kubernetes-apis/deps.ts";
import { CoreV1Api, Namespace, Service } from "@cloudydeno/kubernetes-apis/core/v1";
import { NetworkingV1NamespacedApi } from "@cloudydeno/kubernetes-apis/networking.k8s.io/v1";
import { AppsV1Api } from "@cloudydeno/kubernetes-apis/apps/v1";
import { RawKubeConfig } from "@cloudydeno/kubernetes-client/lib/kubeconfig.ts";
import { ApiextensionsV1Api } from "@cloudydeno/kubernetes-apis/apiextensions.k8s.io/v1";
import * as YAML from "@std/yaml";
import { RestClient } from "@cloudydeno/kubernetes-apis/common.ts";
import { SpdyEnabledRestClient } from "./spdy-enabled-rest-client.ts";
import { match } from "ts-pattern";
import { yaml } from "@tmpl/core";

const kubeconfig = Deno.env.get("KUBECONFIG") || Deno.env.get("HOME") + "/.kube/config";

export async function getKubeClient() {
  let client: RestClient;
  try {
    client = await SpdyEnabledRestClient.forInCluster();
  } catch {
    const decoder = new TextDecoder("utf-8");
    const kubeconfigFile = decoder.decode(await Deno.readFile(kubeconfig));
    client = await SpdyEnabledRestClient.forKubeConfig(
      new KubeConfig(YAML.parse(kubeconfigFile.toString()) as RawKubeConfig) as any,
    );
  }
  return {
    performRequest: client.performRequest.bind(client),
    get CoreV1() {
      return new CoreV1Api(client);
    },
    get AppsV1() {
      return new AppsV1Api(client);
    },
    NetworkingV1NamespacedApi(namespace: string) {
      return new NetworkingV1NamespacedApi(client, namespace);
    },
    TraefikV1Alpha1(namespace: string) {
      return {
        getIngressRoute: (name: string) =>
          client.performRequest({
            method: "GET",
            path: `/apis/traefik.io/v1alpha1/namespaces/${namespace}/ingressroutes/${name}`,
            expectJson: true,
          }) as Promise<TraefikV1Alpha1IngressRoute>,
        createIngressRoute: (body: TraefikV1Alpha1IngressRoute) =>
          client.performRequest({
            method: "POST",
            path: `/apis/traefik.io/v1alpha1/namespaces/${namespace}/ingressroutes`,
            bodyJson: body,
            expectJson: true,
          }),
        deleteIngressRoute: (name: string) =>
          client.performRequest({
            method: "DELETE",
            path: `/apis/traefik.io/v1alpha1/namespaces/${namespace}/ingressroutes/${name}`,
            expectJson: true,
          }),
        listIngressRoutes: () =>
          client.performRequest({
            method: "GET",
            path: `/apis/traefik.io/v1alpha1/namespaces/${namespace}/ingressroutes`,
            expectJson: true,
          }) as Promise<List<TraefikV1Alpha1IngressRoute>>,
      };
    },
    GatewayNetworkingV1(namespace: string) {
      return {
        getGateway: (name: string) =>
          client.performRequest({
            method: "GET",
            path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/gateways/${name}`,
            expectJson: true,
          }) as Promise<GatewayV1>,
        createGateway: (body: GatewayV1) =>
          client.performRequest({
            method: "POST",
            path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/gateways`,
            bodyJson: body,
            expectJson: true,
          }),
        patchGateway: (name: string, body: GatewayV1) =>
          client.performRequest({
            method: "PATCH",
            path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/gateways/${name}`,
            bodyJson: body,
            contentType: "application/merge-patch+json",
            expectJson: true,
          }),
        deleteGateway: (name: string) =>
          client.performRequest({
            method: "DELETE",
            path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/gateways/${name}`,
            expectJson: true,
          }),
        getHTTPRoute: (name: string) =>
          client.performRequest({
            method: "GET",
            path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/httproutes/${name}`,
            expectJson: true,
          }) as Promise<HTTPRoute>,
        createHTTPRoute: (body: HTTPRoute) =>
          client.performRequest({
            method: "POST",
            path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/httproutes`,
            bodyJson: body,
            expectJson: true,
          }),
        // patchHTTPRoute: (name: string, body: any) =>
        //   client.performRequest({
        //     method: "PATCH",
        //     path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/httproutes/${name}`,
        //     body,
        //     expectJson: true,
        //   }),
        deleteHTTPRoute: (name: string) =>
          client.performRequest({
            method: "DELETE",
            path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/httproutes/${name}`,
            expectJson: true,
          }),
        listHTTPRoutes: () =>
          client.performRequest({
            method: "GET",
            path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/httproutes`,
            expectJson: true,
          }),
        getReferenceGrant: (name: string) =>
          client.performRequest({
            method: "GET",
            path: `/apis/gateway.networking.k8s.io/v1beta1/namespaces/${namespace}/referencegrants/${name}`,
            expectJson: true,
          }) as Promise<GatewayV1Beta1ReferenceGrant>,
        createReferenceGrant: (body: GatewayV1Beta1ReferenceGrant) =>
          client.performRequest({
            method: "POST",
            path: `/apis/gateway.networking.k8s.io/v1beta1/namespaces/${namespace}/referencegrants`,
            bodyJson: body,
            expectJson: true,
          }),
        deleteReferenceGrant: (name: string) =>
          client.performRequest({
            method: "DELETE",
            path: `/apis/gateway.networking.k8s.io/v1beta1/namespaces/${namespace}/referencegrants/${name}`,
            expectJson: true,
          }),
      };
    },
    GatewayNetworkingV1Alpha2(namespace: string) {
      return {
        getTLSRoute: (name: string) =>
          client.performRequest({
            method: "GET",
            path: `/apis/gateway.networking.k8s.io/v1alpha2/namespaces/${namespace}/tlsroutes/${name}`,
            expectJson: true,
          }) as Promise<TLSRoute>,
        createTLSRoute: (body: any) =>
          client.performRequest({
            method: "POST",
            path: `/apis/gateway.networking.k8s.io/v1alpha2/namespaces/${namespace}/tlsroutes`,
            bodyJson: body,
            expectJson: true,
          }),
        deleteTLSRoute: (name: string) =>
          client.performRequest({
            method: "DELETE",
            path: `/apis/gateway.networking.k8s.io/v1alpha2/namespaces/${namespace}/tlsroutes/${name}`,
            expectJson: true,
          }),
      };
    },
    ExternalDNSV1alpha1(namespace: string) {
      return {
        getDNSEndpoint: (name: string) =>
          client.performRequest({
            method: "GET",
            path: `/apis/externaldns.k8s.io/v1alpha1/namespaces/${namespace}/dnsendpoints/${name}`,
            expectJson: true,
          }) as Promise<DNSEndpoint>,
        createDNSEndpoint: (body: DNSEndpoint) =>
          client.performRequest({
            method: "POST",
            path: `/apis/externaldns.k8s.io/v1alpha1/namespaces/${namespace}/dnsendpoints`,
            bodyJson: body,
            expectJson: true,
          }),
        deleteDNSEndpoint: (name: string) =>
          client.performRequest({
            method: "DELETE",
            path: `/apis/externaldns.k8s.io/v1alpha1/namespaces/${namespace}/dnsendpoints/${name}`,
            expectJson: true,
          }),
      };
    },
    CertManagerV1(namespace: string) {
      return {
        getCertificate: (name: string) =>
          client.performRequest({
            method: "GET",
            path: `/apis/cert-manager.io/v1/namespaces/${namespace}/certificates/${name}`,
            expectJson: true,
          }) as Promise<CertManagerV1Certificate>,
        getCertificatesList: (): Promise<List<CertManagerV1Certificate>> =>
          client.performRequest({
            method: "GET",
            path: `/apis/cert-manager.io/v1/namespaces/${namespace}/certificates`,
            expectJson: true,
          }) as Promise<List<CertManagerV1Certificate>>,
        createCertificate: (body: any) =>
          client.performRequest({
            method: "POST",
            path: `/apis/cert-manager.io/v1/namespaces/${namespace}/certificates`,
            bodyJson: body,
            expectJson: true,
          }),
        deleteCertificate: (name: string) =>
          client.performRequest({
            method: "DELETE",
            path: `/apis/cert-manager.io/v1/namespaces/${namespace}/certificates/${name}`,
            expectJson: true,
          }),
      };
    },
    get ApiextensionsV1Api() {
      return new ApiextensionsV1Api(client);
    },
  };
}

export type KubeClient = Awaited<ReturnType<typeof getKubeClient>>;

export type List<T> = {
  apiVersion: string;
  kind: string;
  metadata: {
    resourceVersion: string;
    selfLink: string;
  };
  items: T[];
};

export type TraefikV1Alpha1IngressRoute = {
  apiVersion: "traefik.io/v1alpha1";
  kind: "IngressRoute";
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
  };
  spec: {
    entryPoints: string[];
    routes: Array<{
      match: string;
      kind: string;
      services: Array<{
        name: string;
        port: number;
      }>;
    }>;
    tls?: {
      certResolver?: string;
      domains?: Array<{
        main: string;
        sans: string[];
      }>;
      secretName?: string;
    };
  };
};

export type HTTPRoute = {
  apiVersion: "gateway.networking.k8s.io/v1";
  kind: "HTTPRoute";
  metadata: {
    namespace: string;
    name: string;
    labels?: Record<string, string>;
  };
  spec: {
    hostnames: string[];
    parentRefs: Array<{
      name: string;
      namespace: string;
      sectionName: string;
    }>;
    rules: any[];
  };
};

export type TLSRoute = {
  apiVersion: "gateway.networking.k8s.io/v1alpha2";
  kind: "TLSRoute";
  metadata: {
    namespace: string;
    name: string;
    labels?: Record<string, string>;
  };
  spec: {
    hostnames: string[];
    parentRefs: Array<{
      name: string;
      namespace: string;
      sectionName: string;
    }>;
    rules: Array<{
      backendRefs: Array<{
        kind: string;
        name: string;
        port: number;
      }>;
    }>;
  };
};

export type DNSEndpoint = {
  apiVersion: "externaldns.k8s.io/v1alpha1";
  kind: "DNSEndpoint";
  metadata: {
    name: string;
    namespace: string;
  };
  spec: {
    endpoints: Array<{
      dnsName: string;
      recordTTL: number;
      recordType: string;
      targets: string[];
    }>;
  };
};

type CiliumNetworkPolicy = {
  apiVersion: "cilium.io/v2";
  kind: "CiliumNetworkPolicy";
  metadata: {
    name: string;
    namespace: string;
  };
  spec: {
    endpointSelector: {
      matchLabels: Record<string, string>;
    };
    ingress: Array<{
      fromEndpoints?: Array<{
        matchLabels: Record<string, string>;
      }>;
      fromEntities?: string[];
    }>;
    egress: Array<{
      toEndpoints?: Array<{
        matchLabels: Record<string, string>;
      }>;
      toEntities?: string[];
      toPorts?: Array<{
        ports: Array<{
          port: string;
          protocol: string;
        }>;
        rules?: {
          dns?: Array<{ matchPattern: string }>;
        };
      }>;
    }>;
  };
};

type CertManagerV1Certificate = {
  apiVersion: "cert-manager.io/v1";
  kind: "Certificate";
  metadata: {
    name: string;
    namespace: string;
  };
  spec: {
    secretName: string;
    issuerRef: {
      name: string;
      kind: string;
    };
    commonName: string;
    dnsNames: string[];
  };
};

type GatewayV1 = {
  apiVersion: "gateway.networking.k8s.io/v1";
  kind: "Gateway";
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
  };
  spec: {
    gatewayClassName: string;
    listeners: Array<{
      name: string;
      port: number;
      protocol: string;
      tls?: {
        mode: string;
        certificateRefs: Array<{
          name: string;
          namespace?: string;
          kind: string;
        }>;
      };
    }>;
  };
};

type GatewayV1Beta1ReferenceGrant = {
  apiVersion: "gateway.networking.k8s.io/v1beta1";
  kind: "ReferenceGrant";
  metadata: {
    name: string;
    namespace: string;
  };
  spec: {
    from: Array<{
      group: string;
      kind: string;
      name: string;
      namespace?: string;
    }>;
    to: Array<{
      group: string;
      kind: string;
      name: string;
      namespace?: string;
    }>;
  };
};

async function ensureNamespace(kc: KubeClient, namespace: Namespace): Promise<void> {
  const namespaceName = namespace.metadata!.name!;
  await match(
    // Get the namespace and return null if it does not exist
    await kc.CoreV1.getNamespace(namespaceName).catch(() => null),
  )
    // if namespace does not exist, create it
    .with(null, () => kc.CoreV1.createNamespace(namespace))
    // if namespace exists, and match values, do nothing, else, patch it to ensure it match
    .with(namespace as any, () => true)
    .otherwise(() =>
      kc.CoreV1.patchNamespace(
        namespaceName,
        "apply-patch",
        namespace,
        {
          fieldManager: "ctnr.io",
        },
      )
    );
}

async function ensureCiliumNetworkPolicy(
  kc: KubeClient,
  namespace: string,
  networkPolicy: CiliumNetworkPolicy,
): Promise<void> {
  const networkPolicyName = networkPolicy.metadata.name;
  await match(
    // Get the network policy and return null if it does not exist
    await kc.performRequest({
      method: "GET",
      path: `/apis/cilium.io/v2/namespaces/${namespace}/ciliumnetworkpolicies/${networkPolicyName}`,
      expectJson: true,
    })
      .then((res) => res as any)
      .catch(() => null),
  )
    // if network policy does not exist, create it
    .with(null, () =>
      kc.performRequest({
        method: "POST",
        path: `/apis/cilium.io/v2/namespaces/${namespace}/ciliumnetworkpolicies`,
        bodyJson: networkPolicy as any,
        expectJson: true,
      }))
    // if network policy exists, and match values, do nothing, else, replace it to ensure it match
    .with(networkPolicy, () => true)
    .otherwise(async () => {
      console.debug("Replacing existing CiliumNetworkPolicy", networkPolicyName);
      // Delete the existing network policy first
      await kc.performRequest({
        method: "DELETE",
        path: `/apis/cilium.io/v2/namespaces/${namespace}/ciliumnetworkpolicies/${networkPolicyName}`,
        expectJson: true,
      });
      // Then create the new one
      return kc.performRequest({
        method: "POST",
        path: `/apis/cilium.io/v2/namespaces/${namespace}/ciliumnetworkpolicies/${networkPolicyName}`,
        bodyJson: networkPolicy as any,
        expectJson: true,
      });
    });
}

export async function ensureService(kc: KubeClient, namespace: string, service: Service): Promise<void> {
  // Get the service and return null if it does not exist
  const currentService = await kc.CoreV1.namespace(namespace).getService(service.metadata!.name!).catch(() => null);
  const nextService = service;
  await match(
    currentService,
  )
    // if service does not exist, create it
    .with(null, () => kc.CoreV1.namespace(namespace).createService(service))
    // if service exists, and match values, do nothing,
    .with(nextService as any, () => true)
    .otherwise(async () => {
      await kc.CoreV1.namespace(namespace).deleteService(service.metadata!.name!);
      return await kc.CoreV1.namespace(namespace).createService(nextService);
    });
}

export async function ensureIngressRoute(
  kc: KubeClient,
  namespace: string,
  ingressRoute: TraefikV1Alpha1IngressRoute,
): Promise<void> {
  // Ensure the ingress route
  const currentIngressRoute = await kc.TraefikV1Alpha1(namespace).getIngressRoute(ingressRoute.metadata.name).catch(
    () => null,
  );
  const nextIngressRoute = ingressRoute;
  await match(
    currentIngressRoute,
  )
    // if ingress route does not exist, create it
    .with(null, () => kc.TraefikV1Alpha1(namespace).createIngressRoute(nextIngressRoute as any))
    // if ingress route exists, and match values, do nothing,
    .with(nextIngressRoute as any, () => true)
    .otherwise(async () => {
      // else if the ingress route doesn't have the same name, delete it and create a new one
      await kc.TraefikV1Alpha1(namespace).deleteIngressRoute(currentIngressRoute!.metadata.name);
      await kc.TraefikV1Alpha1(namespace).createIngressRoute(nextIngressRoute as any);
    });
}

export async function ensureHTTPRoute(kc: KubeClient, namespace: string, httpRoute: HTTPRoute): Promise<void> {
  // Ensure the httproute
  const currentHttpRoute = await kc.performRequest({
    method: "GET",
    path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/httproutes/${httpRoute.metadata.name}`,
    expectJson: true,
  })
    .then((res) => res as HTTPRoute)
    .catch(() => null);
  const nextHttpRoute = httpRoute;
  await match(
    currentHttpRoute,
  )
    // if httproute does not exist, create it
    .with(null, () =>
      kc.performRequest({
        method: "POST",
        path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/httproutes`,
        bodyJson: nextHttpRoute as any,
        expectJson: true,
      }))
    .with(nextHttpRoute as any, () => true)
    .otherwise(async () => {
      // else if the httproute doesn't have the same name, delete it and create a new one
      await kc.performRequest({
        method: "DELETE",
        path:
          `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/httproutes/${currentHttpRoute?.metadata.name}`,
        expectJson: true,
      });
      await kc.performRequest({
        method: "POST",
        path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/httproutes`,
        bodyJson: nextHttpRoute as any,
        expectJson: true,
      });
    });
}

export async function ensureTLSRoute(
  kc: KubeClient,
  namespace: string,
  tlsRoute: TLSRoute,
): Promise<void> {
  // Ensure the tlsroute
  const currentTLSRoute = await kc.GatewayNetworkingV1Alpha2(namespace).getTLSRoute(tlsRoute.metadata.name).catch(() =>
    null
  );
  const nextTLSRoute = tlsRoute;
  await match(
    currentTLSRoute,
  )
    // if tlsroute does not exist, create it
    .with(null, () => kc.GatewayNetworkingV1Alpha2(namespace).createTLSRoute(nextTLSRoute as any))
    .with(nextTLSRoute as any, () => true)
    .otherwise(async () => {
      // else if the tlsroute doesn't have the same name, delete it and create a new one
      await kc.GatewayNetworkingV1Alpha2(namespace).deleteTLSRoute(currentTLSRoute!.metadata.name);
      await kc.GatewayNetworkingV1Alpha2(namespace).createTLSRoute(nextTLSRoute as any);
    });
}

export async function ensureDNSEndpoint(
  kc: KubeClient,
  namespace: string,
  dnsEndpoint: DNSEndpoint,
): Promise<void> {
  // Ensure the dnsendpoint
  const currentDNSEndpoint = await kc.ExternalDNSV1alpha1(namespace).getDNSEndpoint(dnsEndpoint.metadata.name).catch(
    () => null,
  );
  const nextDNSEndpoint = dnsEndpoint;
  await match(
    currentDNSEndpoint,
  )
    // if dnsendpoint does not exist, create it
    .with(null, () => kc.ExternalDNSV1alpha1(namespace).createDNSEndpoint(nextDNSEndpoint as any))
    .with(nextDNSEndpoint as any, () => true)
    .otherwise(async () => {
      // else if the dnsendpoint doesn't have the same name, delete it and create a new one
      await kc.ExternalDNSV1alpha1(namespace).deleteDNSEndpoint(currentDNSEndpoint!.metadata.name);
      await kc.ExternalDNSV1alpha1(namespace).createDNSEndpoint(nextDNSEndpoint as any);
    });
}

export async function ensureCertManagerCertificate(
  kc: KubeClient,
  namespace: string,
  certificate: CertManagerV1Certificate,
): Promise<void> {
  const currentCertificate = await kc.CertManagerV1(namespace).getCertificate(certificate.metadata.name).catch(() =>
    null
  );
  const nextCertificate = certificate;
  await match(
    currentCertificate,
  )
    // if certificate does not exist, create it
    .with(null, () => kc.CertManagerV1(namespace).createCertificate(nextCertificate as any))
    // if certificate exists, and match values, do nothing,
    .with(nextCertificate as any, () => true)
    .otherwise(async () => {
      // else if the certificate doesn't have the same name, delete it and create a new one
      await kc.CertManagerV1(namespace).deleteCertificate(currentCertificate!.metadata.name);
      await kc.CertManagerV1(namespace).createCertificate(nextCertificate as any);
    });
}

async function _ensureGateway(
  kc: KubeClient,
  namespace: string,
  gateway: GatewayV1,
): Promise<void> {
  // Get the gateway and return null if it does not exist
  const currentGateway = await kc.GatewayNetworkingV1(namespace).getGateway(gateway.metadata.name).catch(() => null);
  await match(
    currentGateway,
  )
    // if gateway does not exist, create it
    .with(null, () => kc.GatewayNetworkingV1(namespace).createGateway(gateway))
    // if gateway exists, and match values, do nothing,
    .with(gateway as any, () => true)
    .otherwise(async () => {
      await kc.GatewayNetworkingV1(namespace).patchGateway(gateway.metadata.name, gateway);
    });
}

async function _ensureReferenceGrant(
  kc: KubeClient,
  namespace: string,
  referenceGrant: GatewayV1Beta1ReferenceGrant,
): Promise<void> {
  // Get the reference grant and return null if it does not exist
  const currentReferenceGrant = await kc.GatewayNetworkingV1(namespace).getReferenceGrant(referenceGrant.metadata.name)
    .catch(() => null);
  await match(
    currentReferenceGrant,
  )
    // if reference grant does not exist, create it
    .with(null, () => kc.GatewayNetworkingV1(namespace).createReferenceGrant(referenceGrant))
    // if reference grant exists, and match values, do nothing,
    .with(referenceGrant as any, () => true)
    .otherwise(async () => {
      await kc.GatewayNetworkingV1(namespace).deleteReferenceGrant(referenceGrant.metadata.name);
      await kc.GatewayNetworkingV1(namespace).createReferenceGrant(referenceGrant);
    });
}

export const ensureUserNamespace = async (
  kc: KubeClient,
  userId: string,
): Promise<string> => {
  const namespaceName = "ctnr-user-" + userId;
  const namespace: Namespace = {
    metadata: {
      name: namespaceName,
      labels: {
        "ctnr.io/owner-id": userId,
      },
    },
  };

  // Ensure the namespace has correct network policies
  const networkPolicyName = "ctnr-user-network-policy";
  const networkPolicy = yaml`
    apiVersion: cilium.io/v2
    kind: CiliumNetworkPolicy
    metadata:
      name: ${networkPolicyName}
      namespace: ${namespaceName}
      labels:
        "ctnr.io/owner-id": ${userId}
    spec:
      endpointSelector:
        matchLabels:
          "k8s:io.kubernetes.pod.namespace": ${namespaceName}
      ingress: 
        # Allow from same namespace
        - fromEndpoints:
            - matchLabels:
                "k8s:io.kubernetes.pod.namespace": ${namespaceName}
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
                "k8s:io.kubernetes.pod.namespace": ${namespaceName}
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
  `.parse<CiliumNetworkPolicy>(YAML.parse as any).data!;

  await ensureNamespace(kc, namespace);

  await ensureCiliumNetworkPolicy(kc, namespaceName, networkPolicy);

  return namespaceName;
};

export async function ensureUserRoute(
  kc: KubeClient,
  namespace: string,
  options: {
    userId: string;
    name: string;
    hostnames: string[];
    ports: Array<{ name: string; port: number }>;
  },
): Promise<void> {
  const { userId, name, hostnames, ports } = options;

  await ensureService(kc, namespace, {
    metadata: {
      name: name,
      namespace: namespace,
    },
    spec: {
      ports,
      selector: {
        "ctnr.io/owner-id": userId,
      },
    },
  });

  // Create HTTPRoute for *-<user-id>.ctnr.io
  await ensureHTTPRoute(kc, namespace, {
    apiVersion: "gateway.networking.k8s.io/v1",
    kind: "HTTPRoute",
    metadata: {
      name: name,
      namespace: namespace,
      labels: {
        "ctnr.io/owner-id": userId,
      },
    },
    spec: {
      hostnames: hostnames.filter((h) => h.endsWith(".ctnr.io")),
      parentRefs: [
        {
          name: "public-gateway",
          namespace: "kube-public",
          sectionName: "web",
        },
        {
          name: "public-gateway",
          namespace: "kube-public",
          sectionName: "websecure",
        },
      ],
      rules: [{
        // matches: [{ path: { type: "PathPrefix", value: "/" } }],
        backendRefs: ports.map((port) => ({
          kind: "Service",
          name: name,
          port: port.port,
        })),
      }],
    },
  });

  // Create IngressRoute and Certificate for each custom domain
  const tlds = hostnames
    .filter((h) => !h.endsWith(".ctnr.io"))
    .map((h) => h.split(".").slice(-2).join("."))
    .filter((tld, index, self) => self.indexOf(tld) === index);

  for (const tld of tlds) {
    const hostnamesForTLD = hostnames.filter((h) => h.endsWith(`.${tld}`));
    await ensureCertManagerCertificate(kc, namespace, {
      apiVersion: "cert-manager.io/v1",
      kind: "Certificate",
      metadata: {
        name: tld,
        namespace: namespace,
      },
      spec: {
        secretName: tld,
        issuerRef: {
          name: "letsencrypt",
          kind: "ClusterIssuer",
        },
        commonName: hostnamesForTLD[0],
        dnsNames: hostnamesForTLD,
      },
    });
    await ensureIngressRoute(kc, namespace, {
      apiVersion: "traefik.io/v1alpha1",
      kind: "IngressRoute",
      metadata: {
        name: tld,
        namespace: namespace,
        labels: {
          "ctnr.io/owner-id": userId,
        },
      },
      spec: {
        entryPoints: ["web", "websecure"],
        routes: hostnamesForTLD.map((hostname) => ({
          match: `Host("${hostname}")`,
          kind: "Rule",
          services: ports.map((port) => ({
            name: name,
            port: port.port,
          })),
        })),
        tls: {
          secretName: tld,
        },
      },
    });
  }
}
