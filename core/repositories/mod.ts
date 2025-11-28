/**
 * Repository Layer
 * Provides data access abstractions for Kubernetes resources
 * 
 * Repositories use:
 * - kubeClient['karmada'] for write operations (propagates to member clusters)
 * - kubeClient[project.cluster] for reading sub-resources (pods, metrics)
 */

// Base classes
export {
  BaseRepository,
  BaseOwnerRepository,
  type KubeCluster,
  type RepositoryProject,
  type ListOptions,
} from './base_repository.ts'

// Resource repositories
export { ContainerRepository, type ListContainersOptions, type CreateContainerInput } from './container_repository.ts'
export { VolumeRepository, type ListVolumesOptions, type CreateVolumeInput } from './volume_repository.ts'
export { RouteRepository, type ListRoutesOptions, type CreateRouteInput } from './route_repository.ts'
export { DomainRepository, type ListDomainsOptions, type CreateDomainInput } from './domain_repository.ts'
export { ProjectRepository, type ListProjectsOptions } from './project_repository.ts'

// Billing repositories
export { InvoiceRepository, type ListInvoicesOptions } from './invoice_repository.ts'
export { UsageRepository, type UsageOptions, type SetLimitsInput, type Usage, type BalanceStatus } from './usage_repository.ts'
export { BillingClientRepository } from './billing_repository.ts'
