import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { Project } from 'lib/api/schemas.ts'
import { createServerProjectContext } from 'api/context/server/project.ts'
import { ServerProjectContext } from 'api/context/mod.ts'
import { ProjectRepository } from 'core/repositories/mod.ts'

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

  const projectRepo = new ProjectRepository(ctx.kube.client, ctx.auth.user.id)

  // Find the project
  const project = await projectRepo.getByName(input.name || '', signal)
  if (!project) {
    throw new Error(`Project not found`)
  }

  // Ensure project is properly configured
  await projectRepo.ensure(project.id, project.name, signal)

  // Update context
  request.ctx = {
    ...ctx,
    ...createServerProjectContext(request.ctx, { id: project.id }),
  }

  return {
    id: project.id,
    name: project.name,
    ownerId: project.ownerId,
    cluster: project.cluster,
  }
}