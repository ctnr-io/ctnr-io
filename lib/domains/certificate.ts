import { KubeClient } from '../kubernetes/kube-client.ts'

export interface CreateDomainCertificateOptions {
  domain: string
  userId: string
  namespace: string
  kubeClient: KubeClient
  cluster?: string
  provider?: string
  ssl?: boolean
}

/**
 * Create a Certificate resource for a custom domain
 */
export async function* createDomainCertificate(
  options: CreateDomainCertificateOptions
): AsyncGenerator<string, void> {
  const { 
    domain, 
    userId, 
    namespace, 
    kubeClient, 
    cluster = 'eu', 
    provider,
    ssl = true 
  } = options

  const certificateName = domain.replace(/\./g, '-')

  // Check if certificate already exists
  try {
    await kubeClient.CertManagerV1(namespace).getCertificate(certificateName)
    throw new Error(`Certificate for domain ${domain} already exists`)
  } catch (error: any) {
    if (error.status !== 404) {
      throw error
    }
    // Certificate doesn't exist, proceed with creation
  }

  yield `Creating SSL certificate for ${domain}...`

  // Create Certificate for the domain
  const certificateManifest = {
    apiVersion: 'cert-manager.io/v1' as const,
    kind: 'Certificate' as const,
    metadata: {
      name: certificateName,
      namespace,
      labels: {
        'ctnr.io/owner-id': userId,
        'ctnr.io/resource-type': 'domain',
        'ctnr.io/domain-name': domain,
        'ctnr.io/cluster': cluster,
      },
      annotations: {
        'ctnr.io/created-by': 'ctnr-api',
        'ctnr.io/created-at': new Date().toISOString(),
        ...(provider && { 'ctnr.io/dns-provider': provider }),
      },
    },
    spec: {
      secretName: certificateName,
      issuerRef: {
        name: 'letsencrypt',
        kind: 'ClusterIssuer',
      },
      commonName: domain,
      dnsNames: [domain],
    },
  }

  // Create the Certificate
  await kubeClient.CertManagerV1(namespace).createCertificate(certificateManifest)

  yield `Certificate created for ${domain}`
  if (ssl) {
    yield `SSL certificate will be automatically provisioned via Let's Encrypt`
  }
  if (provider) {
    yield `DNS provider: ${provider}`
  }
  yield `Cluster: ${cluster}`
}