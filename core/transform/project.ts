/**
 * Project Transform Functions
 * Converts between Kubernetes Namespace and Project DTOs
 */
import type { Namespace } from '@cloudydeno/kubernetes-apis/core/v1'
import type { Project, ProjectSummary, ClusterName } from 'core/schemas/mod.ts'
import { getNamespaceBalance } from 'core/rules/billing/balance.ts'
import { ProjectNamespaceLabels } from 'core/rules/tenancy/project.ts'

/**
 * Transform Kubernetes Namespace to Project DTO
 */
export function namespaceToProject(ns: Namespace): Project {
  const labels = ns.metadata?.labels || {}
  const balance = getNamespaceBalance(ns)

  return {
    id: labels[ProjectNamespaceLabels.Id] || '',
    name: labels[ProjectNamespaceLabels.Name] || '',
    ownerId: labels[ProjectNamespaceLabels.OwnerId] || '',
    cluster: (labels[ProjectNamespaceLabels.Cluster] || 'eu-0') as ClusterName,
    namespace: ns.metadata?.name || '',
    createdAt: ns.metadata?.creationTimestamp?.toISOString(),
    balance: {
      credits: balance.credits,
      currency: 'EUR',
    },
  }
}

/**
 * Transform Kubernetes Namespace to Project Summary DTO
 */
export function namespaceToProjectSummary(ns: Namespace): ProjectSummary {
  const labels = ns.metadata?.labels || {}

  return {
    id: labels[ProjectNamespaceLabels.Id] || '',
    name: labels[ProjectNamespaceLabels.Name] || '',
    cluster: (labels[ProjectNamespaceLabels.Cluster] || 'eu-0') as ClusterName,
		namespace: ns.metadata?.name || '',
  }
}

/**
 * Get namespace name from project ID and user ID
 */
export function getNamespaceName(projectId: string, userId: string): string {
  return projectId === userId ? 'ctnr-user-' + userId : 'ctnr-project-' + projectId
}
