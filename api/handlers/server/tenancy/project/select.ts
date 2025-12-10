import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { Project, ClusterName } from 'lib/api/schemas.ts'
import { createServerProjectContext } from 'api/context/server/project.ts'
import { ServerProjectContext } from 'api/context/mod.ts'
import { ensureProject } from 'core/data/tenancy/project.ts'
import { ProjectNamespaceLabels } from 'core/rules/tenancy/project.ts'

export const Meta = {
  aliases: {
    options: {
      output: 'o',
    },
  },
}

export const Input = Project.pick({
  name: true,
}).partial()

export type Input = z.infer<typeof Input>

/**
 * Select project for user.
 */
export default async function* selectProject(
  request: ServerRequest<Input, ServerProjectContext>,
): ServerResponse<Project> {
  const { ctx, input, signal } = request

  // Find the project by name
  const projectName = input.name || ''
  const labelSelector = `${ProjectNamespaceLabels.OwnerId}=${ctx.auth.user.id},${ProjectNamespaceLabels.Name}=${projectName}`
  
  const namespaces = await ctx.kube.client.karmada.CoreV1.getNamespaceList({
    labelSelector,
    abortSignal: signal,
  })
  
  if (namespaces.items.length === 0) {
    throw new Error(`Project not found`)
  }

  const ns = namespaces.items[0]
  const projectId = ns.metadata?.labels?.[ProjectNamespaceLabels.Id] || ''

  // Ensure project is properly configured
  const project = await ensureProject(ctx.kube.client.karmada, {
    userId: ctx.auth.user.id,
    projectId,
    projectName,
  }, signal)

  // Update context
  request.ctx = {
    ...ctx,
    ...createServerProjectContext(request.ctx, { id: project.id }, signal),
  }

  return {
    id: project.id,
    name: project.name,
    ownerId: project.ownerId,
    cluster: project.cluster as ClusterName,
  }
}