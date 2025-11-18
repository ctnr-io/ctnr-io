import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { Project } from 'lib/api/schemas.ts'
import listProjects from './list.ts'
import { createServerProjectContext } from 'ctx/server/project.ts'
import ensureProject from './_ensure.ts'

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
  request: ServerRequest<Input>,
): ServerResponse<Project> {
  const { ctx } = request

  const [project] = yield* listProjects(request)
  if (!project) {
    throw new Error(`Project not found`)
  }

  // Update context
  request.ctx = {
    ...ctx,
    ...createServerProjectContext(request.ctx, { id: project.id })
  }

  yield* ensureProject({
    ...request,
    input: {
      id: project.id,
      name: project.name,
    },
  })
  
  return project
}