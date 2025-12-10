import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { Project, ClusterName } from 'lib/api/schemas.ts'
import { ServerProjectContext } from 'api/context/mod.ts'
import { ProjectNamespaceLabels } from 'core/rules/tenancy/project.ts'

export const Meta = {
  aliases: {
    options: {
      output: 'o',
    },
  },
}

export const Input = Project.pick({
  id: true,
  name: true,
}).partial()

export type Input = z.infer<typeof Input>

/**
 * List all projects for the user.
 */
export default async function* listProjects(
  { ctx, input, signal }: ServerRequest<Input, ServerProjectContext>,
): ServerResponse<Project[]> {
  const labelSelectors = [
    `${ProjectNamespaceLabels.OwnerId}=${ctx.auth.user.id}`,
    input.id && `${ProjectNamespaceLabels.Id}=${input.id}`,
    input.name && `${ProjectNamespaceLabels.Name}=${input.name}`,
  ].filter(Boolean).join(',')

  const namespaces = await ctx.kube.client.karmada.CoreV1.getNamespaceList({
    labelSelector: labelSelectors,
    abortSignal: signal,
  })

  // Map to the expected schema format
  return namespaces.items.map((ns) => {
    const labels = ns.metadata?.labels || {}
    return {
      id: labels[ProjectNamespaceLabels.Id] || '',
      name: labels[ProjectNamespaceLabels.Name] || '',
      ownerId: labels[ProjectNamespaceLabels.OwnerId] || '',
      cluster: (labels[ProjectNamespaceLabels.Cluster] || 'eu-1') as ClusterName,
    }
  })
}
