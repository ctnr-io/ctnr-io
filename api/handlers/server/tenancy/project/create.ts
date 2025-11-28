import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import * as shortUUID from '@opensrc/short-uuid'
import { Name, Project, ClusterName } from 'lib/api/schemas.ts'
import deleteProjectHandler from 'api/handlers/server/tenancy/project/delete.ts'
import selectProject from './select.ts'
import { ServerProjectContext } from 'api/context/mod.ts'
import { ensureProject } from 'core/data/tenancy/project.ts'

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

    // Set project as current project in context
    yield* selectProject({
      ...request,
      input: { name: input.name },
    })

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
    throw new Error('Failed to create project')
  }
}
