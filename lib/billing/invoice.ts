import { KubeClient } from '../kubernetes/kube-client.ts'
import { QontoClient } from './qonto/mod.ts'
import { match } from 'ts-pattern'
import { CreateClientRequest } from './qonto/client.ts'

export async function ensureQontoInvoiceClient(opts: {
  kubeClient: KubeClient
  namespace: string
  qontoClient: QontoClient
  abortSignal: AbortSignal
  invoiceClient: CreateClientRequest
}): Promise<void> {
  const { kubeClient: kc, namespace, qontoClient, abortSignal, invoiceClient } = opts

  // Get the current namespace to check for existing client IDs
  const ns = await kc.CoreV1.getNamespace(namespace, { abortSignal })

  // Determine the label key based on client type
  const labelKey = `ctnr.io/qonto-client-id`

  // Check if client ID already exists in namespace labels
  const existingClientId = ns?.metadata?.labels?.[labelKey]

  // Get the existing client from Qonto (or null if it doesn't exist)
  const existingClient = existingClientId
    ? await qontoClient.getClientSDetails({ id: existingClientId }).catch(() => null)
    : null

  await match(existingClient)
    // If client doesn't exist, create it
    .with(null, async () => {
      const response = await qontoClient.createClient(invoiceClient)
      if (!response.client?.id) {
        throw new Error('Failed to create Qonto client')
      }

      // Update namespace with the new client ID
      await kc.CoreV1.patchNamespace(namespace, 'json-merge', {
        metadata: {
          labels: {
            [labelKey]: response.client.id,
          },
        },
      }, { abortSignal })

      return response.client.id
    })
    // If client exists and matches, do nothing
    .with(invoiceClient as any, () => existingClientId!)
    // Otherwise, delete and recreate the client
    .otherwise(async () => {
      console.debug('Replacing existing Qonto client', existingClientId)

      // Delete the existing client (if it exists in Qonto)
      if (existingClientId) {
        await qontoClient.deleteClient({ id: existingClientId }).catch((error) => {
          // Ignore errors if client doesn't exist in Qonto
          console.warn(`Failed to delete existing Qonto client ${existingClientId}:`, error)
        })
      }

      // Create a new client
      const response = await qontoClient.createClient(invoiceClient)
      if (!response.client?.id) {
        throw new Error('Failed to create Qonto client')
      }

      // Update namespace with the new client ID
      await kc.CoreV1.patchNamespace(namespace, 'json-merge', {
        metadata: {
          labels: {
            [labelKey]: response.client.id,
          },
        },
      }, { abortSignal })

      return response.client.id
    })
}
