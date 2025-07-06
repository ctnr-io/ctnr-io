import { KubeConfig } from "@cloudydeno/kubernetes-apis/deps.ts";
import { CoreV1Api, Namespace } from "@cloudydeno/kubernetes-apis/core/v1";
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
        "ctnr.io/user-id": userId,
      },
    },
  }

  // Ensure the namespace has correct network policies
  const networkPolicyName = "ctnr-user-network-policy";
  const networkPolicy = yaml`
    apiVersion: cilium.io/v2
    kind: CiliumNetworkPolicy
    metadata:
      name: ${networkPolicyName}
      namespace: ${namespaceName}
    spec:
      endpointSelector:
        matchLabels:
          "k8s:io.kubernetes.pod.namespace": ${namespaceName}
      ingress: 
        # Allow from same namespace
        - fromEndpoints:
            - matchLabels:
                "k8s:io.kubernetes.pod.namespace": ${namespaceName}
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
  `.parse(YAML.parse).data!;


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
        }
      )
    );
  
  await match(
    // Get the network policy and return null if it does not exist
    await kc.performRequest({
      method: "GET",
      path: `/apis/cilium.io/v2/namespaces/${namespaceName}/ciliumnetworkpolicies/${networkPolicyName}`,
      expectJson: true,
    })
    .then((res) => res as any)
    .catch(() => null),
  )
    // if network policy does not exist, create it
    .with(null, () => kc.performRequest({
      method: "POST",
      path: `/apis/cilium.io/v2/namespaces/${namespaceName}/ciliumnetworkpolicies`,
      bodyJson: networkPolicy as any,
      expectJson: true,
    }))
    // if network policy exists, and match values, do nothing, else, replace it to ensure it match
    .with(networkPolicy as any, () => true)
    .otherwise(async () => {
      console.debug("Recreate network policy", networkPolicyName, "in namespace", namespaceName);
      // Delete the existing network policy first
      await kc.performRequest({
        method: "DELETE",
        path: `/apis/cilium.io/v2/namespaces/${namespaceName}/ciliumnetworkpolicies/${networkPolicyName}`,
        expectJson: true,
      }); 
      // Then create the new one
      return kc.performRequest({
        method: "POST",
        path: `/apis/cilium.io/v2/namespaces/${namespaceName}/ciliumnetworkpolicies/${networkPolicyName}`,
        bodyJson: networkPolicy as any,
        expectJson: true,
      })
    });

  return namespaceName;
};
