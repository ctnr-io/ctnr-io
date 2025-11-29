import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import * as shortUUID from '@opensrc/short-uuid'
import { Name, Project } from 'lib/api/schemas.ts'
import deleteProject from 'api/handlers/server/project/delete.ts'
import selectProject from './select.ts'
import { ServerProjectContext } from 'api/context/mod.ts'
import { ProjectRepository } from 'core/repositories/mod.ts'
import { ClusterName } from 'core/entities/common.ts'

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

  const projectRepo = new ProjectRepository(ctx.kube.client, ctx.auth.user.id)

  // Generate new project ID
  const projectId = shortUUIDtranslator.new()

  // Check project does not already exist
  const nameExists = await projectRepo.nameExists(input.name, signal)
  if (nameExists) {
    throw new Error(`Project with name ${input.name} already exists`)
  }

  try {
    yield `Creating project ${input.name}...`

    // Create the project
    const project = await projectRepo.create(projectId, { name: input.name }, signal)

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
      yield* deleteProject({
        ...request,
        input: { id: projectId },
      })
    } catch (deleteError) {
      console.error('Failed to delete project after creation failure:', deleteError)
    }
    throw new Error('Failed to create project')
  }
}
