import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { getVerificationRecord } from 'lib/domains/verification.ts'
import { ClusterName } from 'lib/api/schemas.ts'

export const Meta = {
  aliases: {
    options: {},
  },
}

export const Input = z.object({
  name: z.string().regex(
    /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,})+$/,
    'Invalid domain name format (e.g., example.com)',
  ).min(1, 'Domain name is required'),
  cluster: ClusterName.optional(),
})

export type Input = z.infer<typeof Input>

export default async function* (
  { ctx, input, signal }: ServerRequest<Input>,
): ServerResponse<void> {
  const {
    name,
  } = input

  const kubeClient = ctx.kube.client['karmada']

  const rootDomain = name.split('.').slice(-2).join('.').match(
    /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,})+$/,
  )?.[0]
  if (!rootDomain) {
    throw new Error('Invalid domain name format')
  }

  try {
    // Step 1: Add it to the user's domains in namespace
    const annotations = {
      ['domain.ctnr.io/' + rootDomain]: 'pending',
    }
    await kubeClient.CoreV1.patchNamespace(ctx.kube.namespace, 'json-merge', { metadata: { annotations } }, {
      abortSignal: signal,
    })

    const verificationRecord = getVerificationRecord(name, ctx.auth.user.id, ctx.auth.user.createdAt)
    // Create certificate for the domain using cert-manager
    yield ``
    yield `👉 Please add the following DNS TXT record to your domain ${rootDomain} to verify ownership: `
    yield ``

    yield `Type: ${verificationRecord.type}`
    yield `Name: ${verificationRecord.name}`
    yield `Value: ${verificationRecord.value}`
    yield ``

    // Step 1: Verify domain ownership

    yield ``
    yield `Monitor the certificate status to track SSL provisioning progress.`
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    yield `❌ Error creating domain: ${errorMessage}`
    throw error
  }
}
