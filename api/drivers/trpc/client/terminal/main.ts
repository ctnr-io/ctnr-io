import 'lib/log/mod.ts'
import { createCli } from 'trpc-cli'
import { createTrpcClientContext } from '../context.ts'
import { TRPCCLientTerminalRouter } from './router.ts'
import { createAsyncGeneratorListener } from 'lib/ts/async-generator.ts'
import { authStorage } from './storage.ts'
import process from 'node:process'
import installCli from 'api/handlers/client/version/install_cli.ts'
import { createClientAuthContext } from 'api/context/client/auth.ts'
import { createLoggerContext } from 'api/context/logger.ts'
import loginFromTerminal from 'api/handlers/client/auth/login_from_terminal.ts'
import { ClientAuthError, ClientVersionError } from '../../../errors.ts'
import { isTerminalLoadMessage, TerminalOutputMessage } from 'lib/api/types.ts'
import { Spinner } from 'lib/ts/spinner.ts'
import { createVersionContext } from '../../../../context/version.ts'

const spinner = new Spinner()
function handleClientResponse(value: TerminalOutputMessage) {
  if (isTerminalLoadMessage(value)) {
    spinner.start(value.value)
  } else {
    spinner.stop()
    console.info(value)
  }
}

let retry = false
do {
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
        info: (message) => {
          spinner.stop()
          console.warn(message)
        },
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
          const value of installCli({
            ctx: { ...createVersionContext(), ...createLoggerContext() },
            input: {},
          })
        ) {
          handleClientResponse(value)
        }
        spinner.start('🔄 Relaunching command...')
        retry = true
        break
      }
      case error instanceof ClientAuthError: {
        const authContext = await createClientAuthContext({ storage: authStorage })
        for await (
          const value of loginFromTerminal({
            ctx: {
              ...authContext,
              ...createLoggerContext(),
            },
            input: {},
          })
        ) {
          handleClientResponse(value)
        }
        spinner.start('🔄 Relaunching command...')
        retry = true
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
} while (retry)
