/**
 * Kubernetes Resources - Re-export all resources
 */

// Gateway API resources (HTTPRoute, TLSRoute, Gateway)
export * from './gateway/http_route.ts'
export * from './gateway/tls_route.ts'

// Traefik resources (IngressRoute, Middleware)
export * from './traefik/ingress_route.ts'

// Karmada resources (PropagationPolicy, FederatedResourceQuota)
export * from './karmada/cluster_propagation_policy.ts'
export * from './karmada/propagation_policy.ts'
export * from './karmada/federated_resource_quota.ts'

// Cert-Manager resources (Certificate, Issuer, ClusterIssuer)
export * from './cert_manager/certificate.ts'

// Cilium resources (CiliumNetworkPolicy)
export * from './cilium/cilium_network_policy.ts'

// Autoscaling resources (HorizontalPodAutoscaler)
export * from './autoscaling/hpa.ts'

// External DNS resources (DNSEndpoint)
export * from './external_dns/dns_endpoint.ts'

// Core resources (Namespace, ResourceQuota, NetworkPolicy)
export * from './core/namespace.ts'
export * from './core/pvc.ts'
export * from './core/service.ts'