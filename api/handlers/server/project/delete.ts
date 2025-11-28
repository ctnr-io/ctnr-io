import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { Id } from 'lib/api/schemas.ts'
import { ServerProjectContext } from 'api/context/mod.ts'
import { ProjectRepository } from 'core/repositories/mod.ts'

export const Meta = {
  aliases: {
    options: {},
  },
}

export const Input = z.object({
  id: Id.describe('Project unique identifier'),
})

export type Input = z.infer<typeof Input>

/**
 * Delete the whole project and its resources by deleting the namespace.
 */
export default async function* deleteProject(request: ServerRequest<Input, ServerProjectContext>): ServerResponse<void> {
  const { ctx, input, signal } = request

  const projectRepo = new ProjectRepository(ctx.kube.client, ctx.auth.user.id)

  // Check if project exists
  const exists = await projectRepo.exists(input.id, signal)
  if (!exists) {
    throw new Error(`Project with id ${input.id} not found`)
  }

  yield `Deleting project ${input.id}...`

  // Delete project
  try {
    await projectRepo.delete(input.id, signal)
    yield `Project ${input.id} deleted successfully`
  } catch (error) {
    console.error(error)
    throw new Error(`Failed to delete project with id ${input.id}`)
  }
}
