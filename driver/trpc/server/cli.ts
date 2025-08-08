import 'lib/utils.ts'
import { createAsyncGeneratorListener } from 'lib/async-generator.ts'
import { router } from './router.ts'
import { createCli } from 'trpc-cli'
import { createServerContext } from 'ctx/server/mod.ts'
import { getSupabaseClient } from 'lib/supabase.ts'
import { authStorage } from '../client/terminal/storage.ts'

// Override Deno Streams to permit to send string directly to stdout and stderr
const stdout = new WritableStream({
  write(chunk) {
    if (typeof chunk === 'string') {
      chunk = new TextEncoder().encode(chunk)
    }
    Deno.stdout.write(chunk)
  },
  close() {
    Deno.stdout.close()
  },
  abort(reason) {
    console.error('Stdout stream aborted:', reason)
    Deno.stdout.close()
  },
})

const stderr = new WritableStream({
  write(chunk) {
    if (typeof chunk === 'string') {
      chunk = new TextEncoder().encode(chunk)
    }
    Deno.stderr.write(chunk)
  },
  close() {
    Deno.stderr.close()
  },
  abort(reason) {
    console.error('Stderr stream aborted:', reason)
    Deno.stderr.close()
  },
})

// TODO: login if no session found
const supabaseClient = await getSupabaseClient({
  storage: authStorage,
})
const { data: { session } } = await supabaseClient.auth.getSession()
if (!session) {
  throw new Error('No active session found. Please log in first.')
}

export const ctnr = createCli({
  router,
  context: await createServerContext({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    stdio: {
      stdin: Deno.stdin.readable,
      stdout,
      stderr,
      exit: Deno.exit.bind(Deno),
      setRaw: Deno.stdin.setRaw.bind(Deno.stdin),
      signalChan: function* () {
        // if (!Deno.stdin.isTerminal()) {
        //   return;
        // }
        // TODO: Implement signal handling when needed
        // Currently disabled to avoid linting issues
        // yield; // This will never be reached but satisfies the linter
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

ctnr.run()
