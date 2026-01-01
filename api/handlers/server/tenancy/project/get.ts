import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { Project } from 'lib/api/schemas.ts'
import { ServerProjectContext } from 'api/context/mod.ts'
import { getProject } from 'core/data/tenancy/project.ts'

export const Meta = {
  aliases: {
    options: {
      output: 'o',
    },
  },
}

export const Input = z.object({}).optional()
export type Input = z.infer<typeof Input>

export default async function* getProjectHandler(
  request: ServerRequest<Input, ServerProjectContext>,
): ServerResponse<Project> {
  const { ctx, signal } = request

  if (!ctx.project?.id) {
    throw new Error('No project selected in context')
  }

  const project = await getProject(ctx.kube.client.karmada, {
    userId: ctx.auth.user.id,
    projectId: ctx.project.id,
  }, signal)

  if (!project) throw new Error('Project not found')

  return project
}
