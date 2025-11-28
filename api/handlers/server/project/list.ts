import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { Project } from 'lib/api/schemas.ts'
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
  id: true,
  name: true,
}).partial()

export type Input = z.infer<typeof Input>

/**
 * List all projects for the user.
 */
export default async function* listProjects(
  { ctx, input, signal }: ServerRequest<Input, ServerProjectContext>,
): ServerResponse<Project[]> {
  const projectRepo = new ProjectRepository(ctx.kube.client, ctx.auth.user.id)

  const projects = await projectRepo.list({
    id: input.id,
    name: input.name,
  }, signal)

  // Map to the expected schema format
  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    ownerId: p.ownerId,
    cluster: p.cluster,
  }))
}
