import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { Id } from 'lib/api/schemas.ts'
import { ServerProjectContext } from 'api/context/mod.ts'
import { deleteProject, getNamespaceName } from 'core/data/tenancy/project.ts'

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
export default async function* deleteProjectHandler(request: ServerRequest<Input, ServerProjectContext>): ServerResponse<void> {
  const { ctx, input, abortSignal } = request

  // Check if project exists
  const namespaceName = getNamespaceName(input.id, ctx.auth.user.id)
  try {
    await ctx.kube.client.karmada.CoreV1.getNamespace(namespaceName, { abortSignal })
  } catch {
    throw new Error(`Project with id ${input.id} not found`)
  }

  yield ctx.log.loader(`🗑️ Deleting project ${input.id}...`)

  // Delete project
  try {
    await deleteProject(ctx.kube.client.karmada, {
      userId: ctx.auth.user.id,
      projectId: input.id,
    }, abortSignal)
    yield `Project ${input.id} deleted successfully`
  } catch (error) {
    console.error(error)
    throw new Error(`Failed to delete project with id ${input.id}`)
  }
}
