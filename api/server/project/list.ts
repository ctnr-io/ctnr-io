import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ClusterName, Project } from 'lib/api/schemas.ts'
import { ServerProjectContext } from 'ctx/mod.ts'
import { ProjectLabels } from 'lib/api/labels.ts'

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
 *
 * 0. Fetch all namespaces for the current user.
 * 1. Filter by name or id if provided.
 * 2. Return the list of projects.
 */
export default async function* listProjects(
  { ctx, input, signal }: ServerRequest<Input, ServerProjectContext>,
): ServerResponse<Project[]> {
  const kubeClient = ctx.kube.client['karmada']

  // 0. Fetch all namespaces for the current user.
  const namespaces = await kubeClient.CoreV1.getNamespaceList({
    labelSelector: [
     `${ProjectLabels.OwnerId}=${ctx.auth.user.id}`,
      input.id && `${ProjectLabels.Id}=` + input.id,
      input.name && `${ProjectLabels.Name}=` + input.name,
    ].filter(Boolean).join(','),
    abortSignal: signal,
  })

  // 1. Transform namespaces to projects
  const projects: Project[] = namespaces.items.map((ns) => ({
    id: ns.metadata?.labels?.[ProjectLabels.Id] || '',
    name: ns.metadata?.labels?.[ProjectLabels.Name] || '',
    ownerId: ns.metadata?.labels?.[ProjectLabels.OwnerId] || '',
    cluster: (ns.metadata?.labels?.[ProjectLabels.Cluster] || '') as ClusterName,
  }))

  return projects
}
