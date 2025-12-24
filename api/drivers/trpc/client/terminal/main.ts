import 'lib/log/mod.ts'
import { createCli } from 'trpc-cli'
import { createTrpcClientContext } from '../context.ts'
import { TRPCCLientTerminalRouter } from './router.ts'
import { createAsyncGeneratorListener } from 'lib/ts/async-generator.ts'
import { authStorage } from './storage.ts'
import process from 'node:process'
import installCli from 'api/handlers/client/version/install_cli.ts'
import { createClientAuthContext } from 'api/context/client/auth.ts'
import loginFromTerminal from 'api/handlers/client/auth/login_from_terminal.ts'
import { ClientAuthError, ClientVersionError } from '../../../errors.ts'

try {
  const clientCli = createCli({
    router: TRPCCLientTerminalRouter,
    name: 'ctnr',
    version: process.env.CTNR_VERSION,
    description: 'ctnr.io Remote CLI',
    context: await createTrpcClientContext({
      auth: {
        storage: authStorage,
      },
      stdio: {
        stdin: Deno.stdin.readable,
        stdout: Deno.stdout.writable,
        stderr: Deno.stderr.writable,
        exit: Deno.exit.bind(Deno),
        setRaw: Deno.stdin.setRaw.bind(Deno.stdin),
        signalChan: function* () {
          // TODO: Implement signal handling when needed
          // Currently disabled to avoid linting issues
          // yield* createAsyncGeneratorListener(
          //   [
          //     "SIGINT",
          //     "SIGQUIT",
          //   ] as const,
          //   Deno.addSignalListener,
          //   Deno.removeSignalListener,
          //   (eventType) => eventType,
          // );
        } as any,
        terminalSizeChan: async function* () {
          if (!Deno.stdin.isTerminal()) {
            return
          }
          // Send the initial terminal size
          yield Deno.consoleSize()
          // Send terminal size updates
          yield* createAsyncGeneratorListener(
            ['SIGWINCH'],
            Deno.addSignalListener,
            Deno.removeSignalListener,
            Deno.consoleSize,
          )
        },
      },
    }),
  })

  await clientCli.run({
    logger: {
      info: console.warn,
    },
    formatError: (error) => {
      throw error
    },
  })
} catch (error) {
  switch (true) {
    case error instanceof ClientVersionError: {
      // Upgrade client and relaunch command
      console.info('🔄 Upgrading version...')
      for await (
        const msg of installCli({
          ctx: { version: process.env.CTNR_VERSION || 'unknown' },
          input: {},
        })
      ) {
        console.info(msg)
      }
      console.info('⚡️ Upgrade completed. Relaunching command...')
      // Relaunch command
      const p = new Deno.Command(process.argv[0], {
        args: process.argv.slice(1),
        stdin: 'inherit',
        stdout: 'inherit',
        stderr: 'inherit',
        env: Deno.env.toObject(),
      }).spawn()
      const status = await p.status
      Deno.exit(status.code)
      break
    }
    case error instanceof ClientAuthError: {
      for await (
        const msg of loginFromTerminal({
          ctx: await createClientAuthContext({ storage: authStorage }),
          input: {},
        })
      ) {
        console.info(msg)
      }
      console.log([...process.argv])
      const p = new Deno.Command(process.argv[0], {
        args: process.argv.slice(1),
        stdin: 'inherit',
        stdout: 'inherit',
        stderr: 'inherit',
        env: Deno.env.toObject(),
      }).spawn()
      const status = await p.status
      Deno.exit(status.code)
      break
    }
    default: {
      const msg = error instanceof Error ? error.message : String(error)
      // Sanitize noisy compiled ts file path errors
      const sanitized = msg.replace(/\/.*deno-compile-ctnr\/[^\s]+/g, '')
      console.debug(error)
      console.error(sanitized || 'An error occurred while executing command.')
      Deno.exit(1)
    }
  }
}
