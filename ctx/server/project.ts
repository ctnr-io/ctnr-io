import ensureProject from 'api/server/project/_ensure.ts'
import { ServerAuthContext, ServerKubeContext, ServerProjectContext } from '../mod.ts'
import { createDeferer } from 'lib/api/defer.ts'
import listProjects from 'api/server/project/list.ts'

export async function createServerProjectContext(
  parentCtx: ServerAuthContext & ServerKubeContext,
  options: { id?: string },
  signal: AbortSignal,
): Promise<ServerProjectContext> {
  const userId = parentCtx.auth.user.id

  // If there's no project id, ensure the user default project, based on user id
  if (!options.id || options.id === userId) {
    return {
      ...parentCtx,
      project: {
        id: userId,
        ownerId: userId, // Always same as userId for default project
        namespace: `ctnr-user-${userId}`,
      },
    }
  } else {
    const context: ServerProjectContext = {
      ...parentCtx,
      project: {
        id: options.id,
        // We currently don't share projects, so ownerId is the same as userId
        ownerId: userId,
        namespace: `ctnr-project-${options.id}`,
      },
    }
    // Check that project exists
    const project = await listProjects({
      ctx: context,
      input: { id: options.id },
      signal: signal,
    }).next().then((res) => res.value)
    if (!project) {
      throw new Error(`Project with id ${options.id} not found`)
    }
  }

  // Always ensure project is updated to latest state
  for await (
    const _ of ensureProject({
      ctx: context,
      input: {
        id: context.project.id,
      },
      signal: signal,
      defer: createDeferer(),
    })
  );

  return context
}
