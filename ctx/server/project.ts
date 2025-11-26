import ensureProject from 'api/server/project/_ensure.ts'
import { ServerAuthContext, ServerKubeContext, ServerProjectContext } from '../mod.ts'
import { createDeferer } from 'lib/api/defer.ts'
import listProjects from 'api/server/project/list.ts'
import { returnAG } from 'lib/async-generator.ts'
import _ensureProject from 'api/server/project/_ensure.ts'

export async function createServerProjectContext(
  parentCtx: ServerAuthContext & ServerKubeContext,
  options: { id?: string },
): Promise<ServerProjectContext> {
  const userId = parentCtx.auth.user.id

  let context: ServerProjectContext

  return {
    ...parentCtx,
    project: await _ensureProject(
      parentCtx,

    ),
  } 
}
