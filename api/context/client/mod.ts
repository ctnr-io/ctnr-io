import { createClientAuthContext } from './auth.ts'
import { ClientContext, StdioContext } from '../mod.ts'
import { createClientStdioContext } from './stdio.ts'
import { createClientVersionContext } from './version.ts'

export async function createClientContext(opts: {
  auth: {
    storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  }
  stdio?: StdioContext['stdio']
}): Promise<ClientContext> {
  const versionContext = await createClientVersionContext()
  const authContext = await createClientAuthContext(opts.auth)
  const stdioContext = await createClientStdioContext(opts.stdio)
  return {
    __type: 'client',
    ...versionContext,
    ...authContext,
    ...stdioContext,
  }
}
