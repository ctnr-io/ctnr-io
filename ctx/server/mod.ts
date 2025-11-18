import { createServerAuthContext } from './auth.ts'
import { ServerContext, StdioContext } from '../mod.ts'
import { createServerKubeContext } from './kube.ts'
import { createServerStdioContext } from './stdio.ts'
import { createBillingContext } from './billing.ts'
import { createServerProjectContext } from './project.ts'
import { createVersionContext } from '../version.ts'

export async function createServerContext(opts: {
  auth: {
    accessToken: string | undefined
    refreshToken: string | undefined
  }
  project: {
    id?: string
  }
  stdio: StdioContext['stdio']
}, signal: AbortSignal): Promise<ServerContext> {
  const versionContext = await createVersionContext()
  const authContext = await createServerAuthContext(opts)
  const kubeContext = await createServerKubeContext(authContext.auth.user.id, signal)
  const stdioContext = await createServerStdioContext(opts.stdio)
  const billingContext = await createBillingContext({
    ...kubeContext,
    ...authContext,
  }, signal)
  const ServerProjectContext = await createServerProjectContext(
    {
      ...authContext,
      ...kubeContext,
    },
    {
      id: opts.project.id,
    },
  )
  return {
    __type: 'server',
    ...versionContext,
    ...authContext,
    ...kubeContext,
    ...stdioContext,
    ...billingContext,
    ...ServerProjectContext,
  }
}
