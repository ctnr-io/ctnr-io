import { createAuthServerContext } from './auth.ts'
import { ServerContext, StdioContext } from '../mod.ts'
import { createKubeServerContext } from './kube.ts'
import { createStdioServerContext } from './stdio.ts'

export async function createServerContext(opts: {
  accessToken: string | undefined
  refreshToken: string | undefined
  stdio: StdioContext['stdio']
}): Promise<ServerContext> {
  const authContext = await createAuthServerContext(opts)
  const kubeContext = await createKubeServerContext(authContext.auth.user.id)
  const stdioContext = await createStdioServerContext(opts.stdio)
  return {
    __type: 'server',
    ...authContext,
    ...kubeContext,
    ...stdioContext,
  }
}
