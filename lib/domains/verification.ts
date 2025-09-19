import { hash } from 'node:crypto'
import { resolveTxt } from 'node:dns/promises'
import * as shortUUID from '@opensrc/short-uuid'

const shortUUIDtranslator = shortUUID.createTranslator(shortUUID.constants.uuid25Base36)

export interface DomainVerificationOptions {
  domain: string
  userId: string
  userCreatedAt: Date
  signal?: AbortSignal
}

export interface DomainVerificationResult {
  verified: boolean
  txtRecordName: string
  txtRecordValue: string
}

/**
 * Verify domain ownership using TXT record verification
 */
export async function* verifyDomainOwnership(
  options: DomainVerificationOptions
): AsyncGenerator<string, DomainVerificationResult> {
  const { domain, userId, userCreatedAt, signal } = options
  
  const rootDomain = domain.split('.').slice(-2).join('.')
  const userIdShort = shortUUIDtranslator.fromUUID(userId)
  
  // Generate TXT record details
  const txtRecordName = `ctnr-io-ownership-${userIdShort}.${rootDomain}`
  const txtRecordValue = hash('sha256', userCreatedAt.toString() + rootDomain)
  
  // Check if already verified
  const existingValues = await resolveTxt(txtRecordName).catch(() => [])
  if (existingValues.flat().includes(txtRecordValue)) {
    yield `Domain ownership for ${rootDomain} already verified.`
    return {
      verified: true,
      txtRecordName,
      txtRecordValue,
    }
  }
  
  // Display verification instructions
  yield [
    '',
    `Verifying domain ownership for ${rootDomain}...`,
    '',
    'Please create a TXT record with the following details:',
    `Name: ${txtRecordName}`,
    `Value: ${txtRecordValue}`,
    '',
    'After creating the record, we will automatically detect it.',
    '',
  ].join('\r\n')
  
  // Wait for verification
  while (true) {
    yield `Checking for TXT record...`
    
    if (signal?.aborted) {
      throw new Error('Domain ownership verification aborted')
    }
    
    // Check the TXT record every 5 seconds
    const values = await resolveTxt(txtRecordName).catch(() => [])
    if (values.flat().includes(txtRecordValue)) {
      yield `TXT record verified successfully for ${rootDomain}.`
      return {
        verified: true,
        txtRecordName,
        txtRecordValue,
      }
    }
    
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }
}

/**
 * Check if domain is already verified without waiting
 */
export async function isDomainVerified(
  domain: string,
  userId: string,
  userCreatedAt: Date
): Promise<boolean> {
  const rootDomain = domain.split('.').slice(-2).join('.')
  const userIdShort = shortUUIDtranslator.fromUUID(userId)
  const txtRecordName = `ctnr-io-ownership-${userIdShort}.${rootDomain}`
  const txtRecordValue = hash('sha256', userCreatedAt.toString() + rootDomain)
  
  const values = await resolveTxt(txtRecordName).catch(() => [])
  return values.flat().includes(txtRecordValue)
}