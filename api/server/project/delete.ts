import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import * as shortUUID from '@opensrc/short-uuid'
import { Id, Name, Project } from 'lib/api/schemas.ts'
import ensureProject from 'api/server/project/ensure.ts'
import deleteProject from 'api/server/project/delete.ts'
import listProject from 'api/server/project/list.ts'

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
export default async function* createProject(request: ServerRequest<Input>): ServerResponse<void> {
  const { ctx, input } = request

  const kubeClient = ctx.kube.client['karmada']
	const namespaceName = 'ctnr-project-' + input.id

  // 0. Check if namespace exists
  try {
    const namespace = await kubeClient.CoreV1.getNamespace(namespaceName, { abortSignal: request.signal })
    if (!namespace) {
      throw new Error(`Project with id ${input.id} not found`)
    }
  } catch {
    throw new Error(`Project with id ${input.id} not found`)
  }

  // 1. Delete namespace
  try {
    await kubeClient.CoreV1.deleteNamespace(namespaceName, { abortSignal: request.signal })
  } catch (error) {
    console.error(error)
    throw new Error(`Failed to delete project with id ${input.id}`)
  }
}
