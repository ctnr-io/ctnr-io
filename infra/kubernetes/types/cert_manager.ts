/**
 * Cert-Manager Kubernetes Types
 * Types for cert-manager.io CRDs
 */

import type { ObjectMeta } from './common.ts'

/**
 * Certificate issuer reference
 */
export type CertificateIssuerRef = {
  name: string
  kind: 'Issuer' | 'ClusterIssuer'
  group?: string
}

/**
 * Certificate private key configuration
 */
export type CertificatePrivateKey = {
  algorithm?: 'RSA' | 'ECDSA' | 'Ed25519'
  encoding?: 'PKCS1' | 'PKCS8'
  size?: number
  rotationPolicy?: 'Never' | 'Always'
}

/**
 * Certificate spec
 */
export type CertificateSpec = {
  /** Name of the Secret to store the certificate */
  secretName: string
  
  /** Reference to the issuer */
  issuerRef: CertificateIssuerRef
  
  /** Common name (CN) for the certificate */
  commonName?: string
  
  /** DNS names (SANs) for the certificate */
  dnsNames?: string[]
  
  /** IP addresses (SANs) for the certificate */
  ipAddresses?: string[]
  
  /** URIs (SANs) for the certificate */
  uris?: string[]
  
  /** Email addresses (SANs) for the certificate */
  emailAddresses?: string[]
  
  /** Certificate duration */
  duration?: string
  
  /** Time before expiry to renew */
  renewBefore?: string
  
  /** Private key configuration */
  privateKey?: CertificatePrivateKey
  
  /** Usages for the certificate */
  usages?: string[]
  
  /** Whether the certificate is a CA */
  isCA?: boolean
  
  /** Secret template for additional labels/annotations */
  secretTemplate?: {
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
}

/**
 * Certificate condition
 */
export type CertificateCondition = {
  type: 'Ready' | 'Issuing'
  status: 'True' | 'False' | 'Unknown'
  reason?: string
  message?: string
  lastTransitionTime?: string
  observedGeneration?: number
}

/**
 * Certificate status
 */
export type CertificateStatus = {
  conditions?: CertificateCondition[]
  notBefore?: string
  notAfter?: string
  renewalTime?: string
  revision?: number
  nextPrivateKeySecretName?: string
  failedIssuanceAttempts?: number
  lastFailureTime?: string
}

/**
 * Certificate resource
 */
export type Certificate = {
  apiVersion: 'cert-manager.io/v1'
  kind: 'Certificate'
  metadata: ObjectMeta
  spec: CertificateSpec
  status?: CertificateStatus
}

/**
 * ClusterIssuer spec (for ACME)
 */
export type ClusterIssuerSpec = {
  acme?: {
    server: string
    email: string
    privateKeySecretRef: {
      name: string
    }
    solvers?: Array<{
      http01?: {
        ingress?: {
          class?: string
          ingressTemplate?: {
            metadata?: {
              labels?: Record<string, string>
              annotations?: Record<string, string>
            }
          }
        }
      }
      dns01?: {
        cloudflare?: {
          email?: string
          apiKeySecretRef?: {
            name: string
            key: string
          }
          apiTokenSecretRef?: {
            name: string
            key: string
          }
        }
        route53?: {
          region: string
          accessKeyID?: string
          secretAccessKeySecretRef?: {
            name: string
            key: string
          }
        }
      }
      selector?: {
        dnsNames?: string[]
        dnsZones?: string[]
        matchLabels?: Record<string, string>
      }
    }>
  }
  ca?: {
    secretName: string
  }
  selfSigned?: Record<string, unknown>
}

/**
 * ClusterIssuer resource
 */
export type ClusterIssuer = {
  apiVersion: 'cert-manager.io/v1'
  kind: 'ClusterIssuer'
  metadata: ObjectMeta
  spec: ClusterIssuerSpec
  status?: {
    conditions?: Array<{
      type: string
      status: 'True' | 'False' | 'Unknown'
      reason?: string
      message?: string
      lastTransitionTime?: string
    }>
    acme?: {
      uri?: string
      lastRegisteredEmail?: string
    }
  }
}

/**
 * Issuer resource (namespace-scoped)
 */
export type Issuer = {
  apiVersion: 'cert-manager.io/v1'
  kind: 'Issuer'
  metadata: ObjectMeta
  spec: ClusterIssuerSpec
  status?: ClusterIssuer['status']
}
