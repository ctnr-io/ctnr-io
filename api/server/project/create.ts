import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import * as shortUUID from '@opensrc/short-uuid'
import { Name, Project } from 'lib/api/schemas.ts'
import _ensureProject from './_ensure.ts'
import deleteProject from 'api/server/project/delete.ts'
import { createServerProjectContext } from 'ctx/server/project.ts'
import selectProject from './select.ts'
import listProjects from './list.ts'
import { ServerProjectContext } from 'ctx/mod.ts'
import ensureProject from 'lib/projects/ensure-project.ts'

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
 * 0. Determine the projectId and cluster in which the project will be created.
 * 1. Ensure the project is created or delete if failed.
 * 2. Add project to context.
 */
export default async function* createProject(request: ServerRequest<Input, ServerProjectContext>): ServerResponse<Project> {
  const { input, ctx, signal } = request

  // 0. Determine the projectId and cluster in which the project will be created.
  const projectId = shortUUIDtranslator.new()

  try {
    // Check project does not already exist
    const existingProjects = yield* listProjects({
      ...request,
      input: {
        name: input.name,
      },
    })
    if (existingProjects.find((p) => p.name === input.name)) {
      throw new Error(`Project with name ${input.name} already exists`)
    }
  } catch (error) {
    throw new Error(`Failed to create project: ${error}`)
  }

  // 1. Ensure the project is created.
  try {
    const project = await ensureProject(
      ctx.kube.client['karmada'],
      {
				userId: ctx.auth.user.id,
        projectId: projectId,
				projectName: input.name,
      },
      signal,
    )

    // 2. Set project as current project in context.
    yield* selectProject(request)

    return project
  } catch (error) {
    console.error(error)
    try {
      yield* deleteProject({
        ...request,
        input: {
          id: projectId,
        },
      })
    } catch (deleteError) {
      console.error('Failed to delete project after creation failure:', deleteError)
    }
    throw new Error('Failed to create project')
  }
}
