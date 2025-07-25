import { KubeConfig } from "@cloudydeno/kubernetes-apis/deps.ts";
import { CoreV1Api, Namespace, Service } from "@cloudydeno/kubernetes-apis/core/v1";
import { NetworkingV1NamespacedApi } from "@cloudydeno/kubernetes-apis/networking.k8s.io/v1";
import { AppsV1Api } from "@cloudydeno/kubernetes-apis/apps/v1";
import { RawKubeConfig } from "@cloudydeno/kubernetes-client/lib/kubeconfig.ts";
import { ApiextensionsV1Api } from "@cloudydeno/kubernetes-apis/apiextensions.k8s.io/v1";
import * as YAML from "@std/yaml";
import { RestClient } from "@cloudydeno/kubernetes-apis/common.ts";
import { SpdyEnabledRestClient } from "./spdy-enabled-rest-client.ts";
import { match, P } from "ts-pattern";
import { yaml } from "@tmpl/core";
import list from "api/server/core/list.ts";

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
    GatewayNetworkingV1(namespace: string) {
      return {
        getHTTPRoute: (name: string): Promise<HTTPRoute> =>
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
      }
    },
    CertManagerV1(namespace: string) {
      return {
        getCertificate: (name: string) =>
          client.performRequest({
            method: "GET",
            path: `/apis/cert-manager.io/v1/namespaces/${namespace}/certificates/${name}`,
            expectJson: true,
          }) as Promise<CertManagerV1Certificate>,
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
        # Allow from same namespace
        - fromEndpoints:
            - matchLabels:
                "k8s:io.kubernetes.pod.namespace": ctnr-system
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
        # Allow to external/public (outside cluster)
        - toEntities:
            - world
  `.parse<CiliumNetworkPolicy>(YAML.parse as any).data!;

  await ensureNamespace(kc, namespace);

  // await ensureCiliumNetworkPolicy(kc, namespaceName, networkPolicy);

  return namespaceName;
};

export type HTTPRoute = {
  apiVersion: "gateway.networking.k8s.io/v1";
  kind: "HTTPRoute";
  metadata: {
    namespace: string;
    name: string;
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
  const nextService = {
    ...service,
    spec: {
      ...service.spec,
      // ports from the current service are added to the next service as they are dynamic and can change
      ports: currentService?.spec?.ports || [],
    },
  } as const;
  await match(
    currentService,
  )
    // if service does not exist, create it
    .with(null, () => kc.CoreV1.namespace(namespace).createService(service))
    // if service exists, and match values, do nothing,
    .with({
      metadata: {
        name: nextService.metadata?.name,
        namespace: nextService.metadata?.namespace,
        labels: nextService.metadata?.labels,
      },
      spec: {
        type: nextService.spec?.type,
        selector: nextService.spec?.selector,
        ports: nextService.spec?.ports as any,
      },
    }, () => true)
    .otherwise(async () => {
      await kc.CoreV1.namespace(namespace).deleteService(service.metadata!.name!);
      return kc.CoreV1.namespace(namespace).createService(nextService)
    });
}

export async function ensureHttpRoute(kc: KubeClient, namespace: string, httpRoute: HTTPRoute): Promise<void> {
  // Ensure the httproute
  const currentHttpRoute = await kc.performRequest({
    method: "GET",
    path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/httproutes/${httpRoute.metadata.name}`,
    expectJson: true,
  })
    .then((res) => res as HTTPRoute)
    .catch(() => null);
  const nextHttpRoute = httpRoute
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
    .with({
      metadata: {
        name: nextHttpRoute.metadata.name,
        namespace: nextHttpRoute.metadata.namespace,
      },
      spec: {
        hostnames: nextHttpRoute.spec.hostnames as any,
        parentRefs: nextHttpRoute.spec.parentRefs as any,
        rules: nextHttpRoute.spec.rules as any,
      },
    }, () => true)
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

export async function ensureDNSEndpoint(
  kc: KubeClient,
  namespace: string,
  dnsEndpoint: DNSEndpoint
): Promise<void> {
  // Get the DNS endpoint and return null if it does not exist
  const currentDnsEndpoint = await kc.performRequest({
    method: "GET",
    path: `/apis/externaldns.k8s.io/v1alpha1/namespaces/${namespace}/dnsendpoints/${dnsEndpoint.metadata.name}`,
    expectJson: true,
  })
    .then((res) => res as DNSEndpoint)
    .catch(() => null);
  await match(
    currentDnsEndpoint,
  )
    // if DNS endpoint does not exist, create it
    .with(null, () =>
      kc.performRequest({
        method: "POST",
        path: `/apis/externaldns.k8s.io/v1alpha1/namespaces/${namespace}/dnsendpoints`,
        bodyJson: dnsEndpoint,
        expectJson: true,
      }))
    // if DNS endpoint exists, and match values, do nothing,
    .with({
      metadata: {
        name: dnsEndpoint.metadata.name,
        namespace: dnsEndpoint.metadata.namespace,
      },
      spec: {
        endpoints: dnsEndpoint.spec.endpoints as any,
      },
    }, () => true)
    .otherwise(async () => {
      await kc.performRequest({
        method: "DELETE",
        path: `/apis/externaldns.k8s.io/v1alpha1/namespaces/${namespace}/dnsendpoints/${dnsEndpoint.metadata.name}`,
        expectJson: true,
      });
      await kc.performRequest({
        method: "POST",
        path: `/apis/externaldns.k8s.io/v1alpha1/namespaces/${namespace}/dnsendpoints/${dnsEndpoint.metadata.name}`,
        bodyJson: dnsEndpoint,
        expectJson: true,
      });

    });
}

export async function ensureCertManagerCertificate(
  kc: KubeClient,
  namespace: string,
  certificate: CertManagerV1Certificate,
): Promise<void> {
  // Get the certificate and return null if it does not exist
  const currentCertificate = await kc.CertManagerV1(namespace).getCertificate(certificate.metadata.name).catch(() => null);
  await match(
    currentCertificate,
  )
    // if certificate does not exist, create it
    .with(null, () =>
      kc.CertManagerV1(namespace).createCertificate(certificate)
    )
    // if certificate exists, and match values, do nothing,
    .with({
      metadata: {
        name: certificate.metadata.name,
        namespace: certificate.metadata.namespace,
      },
      spec: {
        secretName: certificate.spec.secretName,
        issuerRef: certificate.spec.issuerRef,
        commonName: certificate.spec.commonName,
        dnsNames: certificate.spec.dnsNames as any,
      },
    }, () => true)
    .otherwise(async () => {
      await kc.CertManagerV1(namespace).deleteCertificate(certificate.metadata.name);
      await kc.CertManagerV1(namespace).createCertificate(certificate);
    });
}