import { Project } from 'core/schemas/mod.ts'
import { ServerAuthContext, ServerKubeContext, ServerProjectContext } from '../mod.ts'
import { ensureProject, getProject } from 'core/data/tenancy/project.ts'
import { LoggerContext } from 'api/context/logger.ts'

export async function createServerProjectContext(
  ctx: LoggerContext & ServerAuthContext & ServerKubeContext,
  options: { id: string },
  abortSignal: AbortSignal,
): Promise<ServerProjectContext> {
  const ownerId = ctx.auth.user.id

  let project: Project | null = null

  // Check if project exists
  project = await getProject(ctx.kube.client['karmada'], {
    userId: ownerId,
    projectId: options.id,
  })

  if (!project) {
    // Rollback to user project and create if not exists
    project = await ensureProject(ctx.kube.client['karmada'], {
      userId: ownerId,
      projectId: ownerId,
      projectName: ctx.auth.user.email.split('@')[0],
    }, abortSignal)
  } else {
    // Ensure project is properly configured
    project = await ensureProject(ctx.kube.client['karmada'], {
      userId: ownerId,
      projectId: options.id,
      projectName: project.name,
    }, abortSignal)
  }

  return {
    ...ctx,
    project: project,
  }
}
