/**
 * Project Transform Functions
 * Converts between Kubernetes Namespace and Project DTOs
 */
import type { Namespace } from '@cloudydeno/kubernetes-apis/core/v1'
import type { Project, ProjectSummary, ClusterName } from 'core/entities/mod.ts'
import { ProjectLabels } from 'core/adapters/kubernetes/labels/mod.ts'
import { getNamespaceBalance } from 'core/application/billing/balance.ts'

/**
 * Transform Kubernetes Namespace to Project DTO
 */
export function namespaceToProject(ns: Namespace): Project {
  const labels = ns.metadata?.labels || {}
  const balance = getNamespaceBalance(ns)

  return {
    id: labels[ProjectLabels.Id] || '',
    name: labels[ProjectLabels.Name] || '',
    ownerId: labels[ProjectLabels.OwnerId] || '',
    cluster: (labels[ProjectLabels.Cluster] || 'eu-0') as ClusterName,
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
    id: labels[ProjectLabels.Id] || '',
    name: labels[ProjectLabels.Name] || '',
    cluster: (labels[ProjectLabels.Cluster] || 'eu-0') as ClusterName,
		namespace: ns.metadata?.name || '',
  }
}

/**
 * Get namespace name from project ID and user ID
 */
export function getNamespaceName(projectId: string, userId: string): string {
  return projectId === userId ? 'ctnr-user-' + userId : 'ctnr-project-' + projectId
}
