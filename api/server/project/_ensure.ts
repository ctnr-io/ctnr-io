import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ClusterName, ClusterNames, Project } from 'lib/api/schemas.ts'
import {
  CiliumNetworkPolicy,
  ensureCiliumNetworkPolicy,
  ensureClusterPropagationPolicy,
  ensureFederatedResourceQuota,
  ensureNamespace,
} from 'lib/kubernetes/kube-client.ts'
import { getNamespaceBalance } from 'lib/billing/balance.ts'
import { FreeTier } from 'lib/billing/utils.ts'
import { yaml } from '@tmpl/core'
import * as YAML from '@std/yaml'

export const Meta = {
  aliases: {
    options: {},
  },
}

export const Input = Project.pick({
  id: true,
  name: true,
})

export type Input = z.infer<typeof Input>

/**
 * Ensure that a project exists and is properly set up.
 * This must be called everytime a project is accessed to ensure it's properly configured.
 * 
 * 0. Determine the cluster in which the project will be created.
 * 1. Create namespace representing the project in a specific Kubernetes cluster.
 * 2. Add network policies to the namespace.
 *
 * A project represents a namespace in a specific Kubernetes cluster.
 * The project will be owned by the authenticated user.
 */
export default async function* ensureProject(request: ServerRequest<Input>): ServerResponse<Project> {
  const { ctx, input, signal } = request

  const kubeClient = ctx.kube.client['karmada']

  // 0. Determine resources names like namespace, propagation policy, network policies, etc.

  // Determine namespace name
  const namespaceName = 'ctnr-project-' + input.id

  // Get namespace if exists
  let namespaceObj = await kubeClient.CoreV1.getNamespace(namespaceName, { abortSignal: signal }).catch(() => null)

  // Retrieve user ID from context
  const ownerId = namespaceObj?.metadata?.labels?.['ctnr.io/owner-id'] || ctx.auth.user.id

  // Determine cluster name
  const clusterName = (namespaceObj?.metadata?.labels?.['ctnr.io/cluster-name'] ?? ClusterNames[Math.floor(Math.random() * 10 % ClusterNames.length)]) as ClusterName

  const clusterPropagationPolicyName = namespaceName + '-cluster-propagation-policy'
  const networkPolicyName = namespaceName + '-network-policy'

  // 1. Create namespace representing the project in a specific Kubernetes cluster.
  await ensureNamespace(kubeClient, {
    metadata: {
      name: namespaceName,
      labels: {
        'ctnr.io/owner-id': ownerId,
        'ctnr.io/project-id': input.id,
        'ctnr.io/project-name': input.name,
        'ctnr.io/cluster-name': clusterName,
      },
    },
  }, signal)

  // 2. Ensure propagation policy to the cluster.
  await ensureClusterPropagationPolicy(kubeClient, namespaceName, {
    apiVersion: 'policy.karmada.io/v1alpha1',
    kind: 'ClusterPropagationPolicy',
    metadata: {
      name: clusterPropagationPolicyName,
      namespace: namespaceName,
      labels: {
        'ctnr.io/owner-id': ownerId,
      },
    },
    spec: {
      resourceSelectors: [{
        kind: 'Namespace',
        name: namespaceName,
      }],
      placement: {
        clusterAffinity: {
          clusterNames: [clusterName],
        },
      },
      propagateDeps: true, // Also propagate dependent resources
    },
  }, signal)

  // 2. Ensure network policies to the namespace.
  // Est-West traffic only within namespace, allow from ctnr-api and traefik, allow to world.
  await ensureCiliumNetworkPolicy(
    kubeClient,
    namespaceName,
    yaml`
      apiVersion: cilium.io/v2
      kind: CiliumNetworkPolicy
      metadata:
        name: ${networkPolicyName}
        namespace: ${namespaceName}
        labels:
          "ctnr.io/owner-id": ${ownerId}
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
  `.parse<CiliumNetworkPolicy>(YAML.parse as any).data!,
    signal,
  )

  // 3. Check project balance, set limits to Free Tier if no credits.
  namespaceObj = await kubeClient.CoreV1.getNamespace(namespaceName, { abortSignal: signal })
  const balance = getNamespaceBalance(namespaceObj)
  if (balance.credits === 0) {
    await ensureFederatedResourceQuota(kubeClient, namespaceName, {
      apiVersion: 'policy.karmada.io/v1alpha1',
      kind: 'FederatedResourceQuota',
      metadata: {
        name: 'ctnr-resource-quota',
        namespace: namespaceName,
        labels: {
          'ctnr.io/owner-id': ownerId,
        },
      },
      spec: {
        overall: {
          'limits.cpu': FreeTier.cpu,
          'limits.memory': FreeTier.memory,
          'requests.storage': FreeTier.storage,
        },
      },
    }, signal)
  }

  return {
    id: input.id,
    name: input.name,
    ownerId: ownerId,
    clusterName: clusterName,
  }
}
