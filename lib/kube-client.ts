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

  // Ensure the user have one "host" service for all their containers
  // This permit to optimize the number of service IPs allowed in the cluster
  // permitting to have more users than if we used multiple services per user
  const service: Service = {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      namespace: namespaceName,
      name: `ctnr-user-host-service`,
      labels: {
        "ctnr.io/owner-id": userId,
      },
    },
    spec: {
      type: "ClusterIP",
      selector: {
        "ctnr.io/owner-id": userId, // Ensure the service is user-specific
      },
      ports: [
        // Add the default socks port for future use, and permitting to have at least one port exposed for the service to be created
        {
          name: "socks",
          port: 1080,
          targetPort: 1080,
          protocol: "TCP", // Default to TCP for security
          appProtocol: "socks", // Use appProtocol to indicate the protocol used by the container
        }
      ],
    },
  } as const;

  // Ensure the httproute
  const httpRoute = yaml`
    apiVersion: gateway.networking.k8s.io/v1
    kind: HTTPRoute
    metadata:
      namespace: ${namespaceName}
      name: ctnr-user-httproute
      labels:
        "ctnr.io/owner-id": ${userId}
    spec:
      hostnames:
      - "*.${userId}.ctnr.io"
      parentRefs:
      - name: public-gateway
        namespace: kube-public
        sectionName: https
      - name: public-gateway
        namespace: kube-public
        sectionName: http
      rules: []
  `.parse<HTTPRoute>(YAML.parse as any).data!;

  await ensureNamespace(kc, namespace);

  await ensureCiliumNetworkPolicy(kc, namespaceName, networkPolicy);

  await ensureService(kc, namespaceName, service);

  await ensureHttpRoute(kc, namespaceName, httpRoute);

  return namespaceName;
};

type HTTPRoute = {
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

async function ensureService(kc: KubeClient, namespace: string, service: Service): Promise<void> {
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
        // ports are not compared here, as they are dynamic and can change
      },
    }, () => true)
    .otherwise(() => {
      // else, patch it to ensure it match
      return kc.CoreV1.namespace(namespace).patchService(
        service.metadata!.name!,
        "apply-patch",
        nextService,
        {
          fieldManager: "ctnr.io",
        },
      );
    });
}

async function ensureHttpRoute(kc: KubeClient, namespace: string, httpRoute: HTTPRoute): Promise<void> {
  // Ensure the httproute
  const currentHttpRoute = await kc.performRequest({
    method: "GET",
    path: `/apis/gateway.networking.k8s.io/v1/namespaces/${namespace}/httproutes/${httpRoute.metadata.name}`,
    expectJson: true,
  })
    .then((res) => res as HTTPRoute)
    .catch(() => null);
  const nextHttpRoute = {
    ...httpRoute,
    spec: {
      ...httpRoute.spec,
      // rules from the current route are added to the next route as they are dynamic and can change
      rules: currentHttpRoute?.spec?.rules || [],
    },
  } as const;
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
        // rules are not compared here, as they are dynamic and can change
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
