import { createAuthClientContext } from './auth.ts'
import { ClientContext, StdioContext } from '../mod.ts'
import { createStdioClientContext } from './stdio.ts'

export async function createClientContext(opts: {
  auth: {
    storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  }
  stdio?: StdioContext['stdio']
}): Promise<ClientContext> {
  const authContext = await createAuthClientContext(opts.auth)
  const stdioContext = await createStdioClientContext(opts.stdio)
  return {
    __type: 'client',
    ...authContext,
    ...stdioContext,
  }
}
