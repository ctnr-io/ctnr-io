import { createAuthServerContext } from './auth.ts'
import { ServerContext, StdioContext } from '../mod.ts'
import { createKubeServerContext } from './kube.ts'
import { createStdioServerContext } from './stdio.ts'
import { createBillingContext } from './billing.ts'
import { createProjectContext } from './project.ts'

export async function createServerContext(opts: {
  auth: {
    accessToken: string | undefined
    refreshToken: string | undefined
  }
  stdio: StdioContext['stdio']
}, signal: AbortSignal): Promise<ServerContext> {
  const authContext = await createAuthServerContext(opts)
  const kubeContext = await createKubeServerContext(authContext.auth.user.id, signal)
  const stdioContext = await createStdioServerContext(opts.stdio)
  const billingContext = await createBillingContext({
    ...kubeContext,
    ...authContext,
  }, signal)
  const projectContext = await createProjectContext()
  return {
    __type: 'server',
    ...authContext,
    ...kubeContext,
    ...stdioContext,
    ...billingContext,
    ...projectContext,
  }
}
