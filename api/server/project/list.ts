import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ClusterName, Project } from 'lib/api/schemas.ts'

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
  { ctx, input, signal }: ServerRequest<Input>,
): ServerResponse<Project[]> {
  const kubeClient = ctx.kube.client['karmada']

  // 0. Fetch all namespaces for the current user.
  const namespaces = await kubeClient.CoreV1.getNamespaceList({
    labelSelector: [
      'ctnr.io/owner-id=' + ctx.auth.user.id,
      input.id && 'ctnr.io/project-id=' + input.id,
      input.name && 'ctnr.io/project-name=' + input.name,
    ].filter(Boolean).join(','),
    abortSignal: signal,
  })

  // 1. Transform namespaces to projects
  const projects: Project[] = namespaces.items.map((ns) => ({
    id: ns.metadata?.labels?.['ctnr.io/project-id'] || '',
    name: ns.metadata?.labels?.['ctnr.io/project-name'] || '',
    ownerId: ns.metadata?.labels?.['ctnr.io/owner-id'] || '',
    clusterName: (ns.metadata?.labels?.['ctnr.io/cluster-name'] || '') as ClusterName,
  }))

  return projects
}
