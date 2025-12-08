import { resolveTxt } from 'node:dns/promises'
import { ClusterName } from 'core/schemas/common.ts'

export interface DomainVerificationOptions {
  domain: string
  projectId: string
  cluster: ClusterName
  signal?: AbortSignal
}

export interface DomainVerificationResult {
  verified: boolean
  recordType: 'CNAME'
  recordName: string
  recordValue: string
}

/**
 * Verify domain ownership using TXT record verification
 */
export async function* verifyDomainOwnership(
  options: DomainVerificationOptions,
): AsyncGenerator<string, DomainVerificationResult> {
  const { domain, projectId, signal } = options

  const rootDomain = domain.split('.').slice(-2).join('.')

  const record = getVerificationRecord(domain, projectId, options.cluster)

  // Check if already verified
  const existingValues = await resolveTxt(record.name).catch(() => [])
  if (existingValues.flat().includes(record.value)) {
    yield `Domain ownership for ${rootDomain} already verified.`
    return {
      verified: true,
      recordType: 'CNAME',
      recordName: record.name,
      recordValue: record.value,
    }
  }

  // Display verification instructions
  yield [
    '',
    `Verifying domain ownership for ${rootDomain}...`,
    '',
    `Please create a ${record.type} record with the following details:`,
    `Name: ${record.name}`,
    `Value: ${record.value}`,
    '',
    'After creating the record, we will automatically detect it.',
    '',
  ].join('\r\n')

  // Wait for verification
  while (true) {
    yield `Checking for CNAME record...`

    if (signal?.aborted) {
      throw new Error('Domain ownership verification aborted')
    }

    // Check the TXT record every 5 seconds
    const values = await resolveTxt(record.name).catch(() => [])
    if (values.flat().includes(record.value)) {
      yield `CNAME record verified successfully for ${rootDomain}.`
      return {
        verified: true,
        recordType: 'CNAME',
        recordName: record.name,
        recordValue: record.value,
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 5000))
  }
}

/**
 * Check if domain is already verified without waiting
 */
export async function* isDomainVerified(
  domain: string,
  projectId: string,
  cluster: ClusterName,
): AsyncGenerator<string, boolean> {
  const record = getVerificationRecord(domain, projectId, cluster)

  const values = await resolveTxt(record.name).catch(() => [])
  if (!values || values.length === 0) {
    // Display verification instructions
    yield [
      '',
      `Verify domain ownership failed for ${record.domain}:`,
      '',
      'Please create a CNAME record with the following details:',
      `Name: ${record.name}`,
      `Value: ${record.value}`,
      '',
      'After creating the record, we will automatically detect it.',
      '',
    ].join('\r\n')
  }
  return values.flat().includes(record.value)
}

export function getVerificationRecord(
  domain: string,
  projectId: string,
  cluster: ClusterName,
): { domain: string; type: string; name: string; value: string } {
  const rootDomain = domain.split('.').slice(-2).join('.')
  const recordName = `${projectId}.${rootDomain}`
  const recordValue = `${projectId}.${cluster}.ctnr.io`
  return {
    type: 'CNAME',
    name: recordName,
    value: recordValue,
    domain: rootDomain,
  }
}
