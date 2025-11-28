import { ClusterName, ClusterNames } from 'lib/api/schemas.ts'
import {
  type CiliumNetworkPolicy,
  ensureCiliumNetworkPolicy,
  ensureClusterPropagationPolicy,
  ensureFederatedResourceQuota,
  ensureNamespace,
  ensurePropagationPolicy,
  type KubeClient,
} from 'infra/kubernetes/mod.ts'
import { getNamespaceBalance } from 'core/rules/billing/balance.ts'
import { FreeTier } from 'core/rules/billing/utils.ts'
import { yaml } from '@tmpl/core'
import * as YAML from '@std/yaml'
import { createProjectNamespaceLabels, ProjectNamespaceLabels } from 'core/rules/tenancy/project.ts'
import { Project } from '../../schemas/mod.ts'

/**
 * Get namespace name from project ID and user ID
 */
export function getNamespaceName(projectId: string, userId: string): string {
  return projectId === userId ? 'ctnr-user-' + userId : 'ctnr-project-' + projectId
}

/**
 * Delete a project (namespace) by ID
 */
export async function deleteProject(
  kubeClient: KubeClient,
  input: { userId: string; projectId: string },
  signal: AbortSignal
): Promise<void> {
  const namespaceName = getNamespaceName(input.projectId, input.userId)
  await kubeClient.CoreV1.deleteNamespace(namespaceName, { abortSignal: signal })
}

/**
 * Ensure that a project exists and is properly set up.
 * This must be called everytime a project is accessed to ensure it's properly configured.
 * 
 * 0. Determine the cluster in which the project will be created.
 * 1. Create namespace representing the project in a specific Kubernetes cluster.
 * 2. Add network policies to the namespace.
 * 3. Check project balance, set limits to Free Tier if no credits.
 *
 * A project represents a namespace in a specific Kubernetes cluster.
 * The project will be owned by the authenticated user.
 */
export async function ensureProject(kubeClient: KubeClient, input: {
	userId: string,
	projectId: string,
	projectName?: string,
}, signal: AbortSignal): Promise<Project> {
const { userId, projectId } = input
console.log('Ensuring project:', projectId, 'for user:', userId)

  // 0. Determine resources names like namespace, propagation policy, network policies, etc.
  // Determine namespace name
  const namespaceName = getNamespaceName(projectId, userId)

  // Get namespace if exists
  let namespaceObj = await kubeClient.CoreV1.getNamespace(namespaceName, { abortSignal: signal }).catch(() => null)

  // Retrieve project name
  const projectName = input.projectName || namespaceObj?.metadata?.labels?.[ProjectNamespaceLabels.Name] || 'default'

  // Retrieve user ID from context
  const ownerId = namespaceObj?.metadata?.labels?.[ProjectNamespaceLabels.OwnerId] || userId

  // Determine cluster name
  const cluster = (namespaceObj?.metadata?.labels?.[ProjectNamespaceLabels.Cluster] ?? ClusterNames[Math.floor(Math.random() * 10 % ClusterNames.length)]) as ClusterName

  const propagationPolicy = 'ctnr-project-propagation-policy'
  const networkPolicyName = 'ctnr-project-network-policy'
  const resourceQuotaName = 'ctnr-project-resource-quota'

  const labels = createProjectNamespaceLabels({
    id: projectId,
    name: projectName,
    ownerId: ownerId,
    cluster: cluster,
  })

  // 1. Create namespace representing the project in a specific Kubernetes cluster.
  await ensureNamespace(kubeClient, {
    metadata: {
      name: namespaceName,
      labels,
    },
  }, signal)

  // 2. Ensure propagation policy to the cluster.
  await ensureClusterPropagationPolicy(kubeClient, namespaceName, {
    apiVersion: 'policy.karmada.io/v1alpha1',
    kind: 'ClusterPropagationPolicy',
    metadata: {
      name: propagationPolicy,
      namespace: namespaceName,
    },
    spec: {
      conflictResolution: 'Overwrite',
      resourceSelectors: [{
        apiVersion: 'v1',
        kind: 'Namespace',
      }],
      placement: {
        clusterAffinity: {
          clusterNames: [cluster],
        },
      },
    },
  }, signal)
  await ensurePropagationPolicy(kubeClient, namespaceName, {
    apiVersion: 'policy.karmada.io/v1alpha1',
    kind: 'PropagationPolicy',
    metadata: {
      name: propagationPolicy,
      namespace: namespaceName,
    },
    spec: {
      conflictResolution: 'Overwrite',
      resourceSelectors: [
        // Core resources
        ['v1', 'Pod'],
        ['v1', 'Service'],
        ['v1', 'ConfigMap'],
        ['v1', 'Secret'],
        ['v1', 'PersistentVolumeClaim'],
        // Apps resources
        ['apps/v1', 'StatefulSet'],
        ['apps/v1', 'DaemonSet'],
        ['apps/v1', 'Deployment'],
        ['apps/v1', 'ReplicaSet'],
        // Gateway resources
        ['networking.x-k8s.io/v1', 'Gateway'],
        ['networking.x-k8s.io/v1', 'HTTPRoute'],
        ['networking.x-k8s.io/v1', 'TCPRoute'],
        ['networking.x-k8s.io/v1', 'TLSRoute'],
        // Traefik resources
        ['traefik.containo.us/v1alpha1', 'Middleware'],
        ['traefik.containo.us/v1alpha1', 'IngressRoute'],
        ['traefik.containo.us/v1alpha1', 'IngressRouteTCP'],
        ['traefik.containo.us/v1alpha1', 'IngressRouteUDP'],
        // Cert-manager resources
        ['cert-manager.io/v1', 'Certificate'],
        // Cilium resources
        ['cilium.io/v2', 'CiliumNetworkPolicy'],
        // ExternalDNS resources
        ['externaldns.k8s.io/v1alpha1', 'DNSEndpoint'],
        // Autoscaler resources
        ['autoscaling/v2', 'HorizontalPodAutoscaler'],
      ].map(([apiVersion, kind]) => ({
        apiVersion,
        kind,
        namespace: namespaceName,
      })),
      placement: {
        clusterAffinity: {
          clusterNames: [cluster],
        },
      },
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
        name: resourceQuotaName,
        namespace: namespaceName,
        labels
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
		id: projectId,
		name: projectName,
		ownerId: ownerId,
		cluster: cluster,
    namespace: namespaceName,
    balance: getNamespaceBalance(namespaceObj),
    createdAt: namespaceObj.metadata?.creationTimestamp ?  new Date(namespaceObj.metadata.creationTimestamp).toISOString() : undefined,
  }
}

/**
 * Get a project by ID
 */
export async function getProject(
	kubeClient: KubeClient,
	input: { userId: string; projectId: string },
	signal?: AbortSignal
): Promise<Project | null> {
	const { userId, projectId } = input
	const namespaceName = getNamespaceName(projectId, userId)

	try {
		const ns = await kubeClient.CoreV1.getNamespace(namespaceName, { abortSignal: signal })
		if (!ns.metadata?.labels?.[ProjectNamespaceLabels.Id]) {
			return null
		}

		return {
			id: ns.metadata.labels[ProjectNamespaceLabels.Id],
			name: ns.metadata.labels[ProjectNamespaceLabels.Name] || 'default',
			ownerId: ns.metadata.labels[ProjectNamespaceLabels.OwnerId] || userId,
			cluster: (ns.metadata.labels[ProjectNamespaceLabels.Cluster] || 'eu-0') as ClusterName,
      namespace: namespaceName,
      balance: getNamespaceBalance(ns),
      createdAt: ns.metadata?.creationTimestamp ?  new Date(ns.metadata.creationTimestamp).toISOString() : undefined,
		}
	} catch {
		return null
	}
}
