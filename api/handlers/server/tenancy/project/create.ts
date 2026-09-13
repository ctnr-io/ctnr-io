import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import * as shortUUID from '@opensrc/short-uuid'
import { Name, Project, ClusterName } from 'lib/api/schemas.ts'
import deleteProjectHandler from 'api/handlers/server/tenancy/project/delete.ts'
import { ServerProjectContext } from 'api/context/mod.ts'
import { createServerProjectContext } from 'api/context/server/project.ts'
import { ensureProject } from 'core/data/tenancy/project.ts'
import { ProjectNamespaceLabels } from 'core/rules/tenancy/project.ts'

export const Meta = {
  aliases: {
    options: {},
  },
}

export const Input = z.object({
  name: Name.describe('Project name'),
})

export type Input = z.infer<typeof Input>

const shortUUIDtranslator = shortUUID.createTranslator(shortUUID.constants.uuid25Base36)

/**
 * Create a new project for the user.
 */
export default async function* createProject(request: ServerRequest<Input, ServerProjectContext>): ServerResponse<Project> {
  const { input, ctx, signal } = request

  // Reject duplicate names per owner: a name-based lookup can't tell same-named projects apart.
  const existing = await ctx.kube.client.karmada.CoreV1.getNamespaceList({
    labelSelector: `${ProjectNamespaceLabels.OwnerId}=${ctx.auth.user.id},${ProjectNamespaceLabels.Name}=${input.name}`,
    abortSignal: signal,
  })
  if (existing.items.length > 0) {
    throw new Error(`Project "${input.name}" already exists`)
  }

  // Generate new project ID
  const projectId = shortUUIDtranslator.new()

  try {
    yield `Creating project ${input.name}...`

    // Create the project using ensureProject
    const project = await ensureProject(ctx.kube.client.karmada, {
      userId: ctx.auth.user.id,
      projectId,
      projectName: input.name,
    }, signal)

    yield `Project ${input.name} created successfully`

    // Select by the ID just minted, never by name (ambiguous across same-named projects).
    request.ctx = {
      ...ctx,
      ...(await createServerProjectContext(ctx, { id: project.id }, signal)),
    }

    return {
      id: project.id,
      name: project.name,
      ownerId: project.ownerId,
      cluster: project.cluster as ClusterName,
    }
  } catch (error) {
    console.error(error)
    try {
      yield* deleteProjectHandler({
        ...request,
        input: { id: projectId },
      })
    } catch (deleteError) {
      console.error('Failed to delete project after creation failure:', deleteError)
    }
    throw new Error(error instanceof Error ? error.message : 'Failed to create project')
  }
}
