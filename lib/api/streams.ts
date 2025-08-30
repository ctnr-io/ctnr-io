import { ServerContext } from 'ctx/mod.ts'
import { Deferer } from './defer.ts'

export const createCtrlPCtrlQHandler = ({ interactive, terminal, stderr }: {
  interactive: boolean
  terminal: boolean
  stderr: WritableStream
}) => {
  let stdinLastChunk: Uint8Array | null = null
  if (terminal && interactive) {
    const stderrWriter = stderr.getWriter()
    stderrWriter.write(`Press Ctrl+P Ctrl+Q to detach.\r\n`)
    stderrWriter.releaseLock()
  }
  return (
    chunk: Uint8Array,
    controller: TransformStreamDefaultController<any>,
  ): void => {
    if (terminal && interactive) {
      // Check for Ctrl+P Ctrl+Q sequence
      if (
        stdinLastChunk?.[0] === 0x10 && chunk[0] === 0x11
      ) {
        // Detach from the container
        controller.terminate()
      } else {
        // Store the last chunk for the next iteration
        stdinLastChunk = chunk
      }
    }
    // Otherwise, just pass the chunk through
    controller.enqueue(chunk)
  }
}

export interface StreamTunnel {
  stdout: ReadableStream
  stderr: ReadableStream
  stdin: WritableStream
  ttySetSize?: (size: { columns: number; rows: number }) => void
}

export const setupSignalHandling = (
  {
    ctx,
    tunnel,
    defer,
    terminal,
    interactive,
  }: {
    ctx: ServerContext
    defer: Deferer
    tunnel: { ttyWriteSignal?: (signal: 'INTR' | 'QUIT' | 'SUSP') => Promise<void> }
    terminal: boolean
    interactive: boolean
  },
) => {
  if (!ctx.stdio) {
    return
  }
  if (terminal) {
    const signalChanAsyncGenerator = ctx.stdio.signalChan()
    defer(() => signalChanAsyncGenerator.return())
    ;(async () => {
      for await (const signal of signalChanAsyncGenerator) {
        switch (signal) {
          case 'SIGINT':
            if (terminal && interactive) {
              tunnel.ttyWriteSignal?.('INTR')
            }
            break
          case 'SIGQUIT':
            if (terminal && interactive) {
              tunnel.ttyWriteSignal?.('QUIT')
            }
            break
        }
      }
    })()
  }
}

export const setupTerminalHandling = ({
  ctx,
  tunnel,
  defer,
  terminal,
  interactive,
}: {
  ctx: ServerContext
  defer: Deferer
  tunnel: StreamTunnel
  terminal: boolean
  interactive: boolean
}) => {
  if (!ctx.stdio) {
    return
  }
  if (terminal) {
    const terminalSizeAsyncGenerator = ctx.stdio.terminalSizeChan()
    defer(() => terminalSizeAsyncGenerator.return())
    ;(async () => {
      for await (const terminalSize of terminalSizeAsyncGenerator) {
        tunnel.ttySetSize?.(terminalSize)
      }
    })()
  }

  if (terminal && interactive) {
    ctx.stdio.setRaw(true)
    defer(() => ctx.stdio?.setRaw(false))
  }
}

export const handleStreams = async ({
  ctx,
  signal,
  tunnel,
  interactive,
  terminal,
}: {
  ctx: ServerContext
  signal: AbortSignal
  defer: Deferer
  tunnel: Partial<StreamTunnel>
  interactive: boolean
  terminal: boolean
}): Promise<void> => {
  if (!ctx.stdio) {
    return
  }

  const handleCtrlPCtrlQStream = new TransformStream({
    transform: createCtrlPCtrlQHandler({
      interactive,
      terminal,
      stderr: ctx.stdio.stderr,
    }),
  })

  // Handle stream connections based on flags
  const streamPromises: Promise<any>[] = []

  // Always pipe stdout and stderr from container to local streams
  if (tunnel.stdout) {
    streamPromises.push(
      tunnel.stdout.pipeTo(ctx.stdio.stdout, {
        signal,
        preventAbort: true,
        preventCancel: true,
        preventClose: true,
      }),
    )
  }

  if (tunnel.stderr) {
    streamPromises.push(
      tunnel.stderr
        .pipeTo(ctx.stdio.stderr, {
          signal,
          preventAbort: true,
          preventCancel: true,
          preventClose: true,
        }),
    )
  }

  if (tunnel.stdin) {
    streamPromises.push(
      ctx.stdio.stdin
        .pipeThrough(handleCtrlPCtrlQStream)
        .pipeTo(interactive ? tunnel.stdin : new WritableStream(), {
          signal,
          preventAbort: true,
          preventCancel: true,
          preventClose: true,
        }),
    )
  }

  try {
    // Wait for any stream to complete
    await Promise.any(streamPromises)
  } catch (error) {
    if (signal.aborted) {
      console.debug(`Stream processing was aborted`)
    } else {
      console.error(error)
    }
  }
}

export async function* combineReadableStreamsToAsyncGenerator(
  sources: { stream: ReadableStream<string>; name: string }[],
): AsyncGenerator<string> {
  // Extended color palette for pod names (like docker-compose)
  const colors = [
    '\x1b[36m', // cyan
    '\x1b[32m', // green
    '\x1b[34m', // blue
    '\x1b[33m', // yellow
    '\x1b[35m', // magenta
    '\x1b[31m', // red
    '\x1b[96m', // bright cyan
    '\x1b[94m', // bright blue
    '\x1b[92m', // bright green
    '\x1b[93m', // bright yellow
    '\x1b[95m', // bright magenta
    '\x1b[91m', // bright red
  ]
  const resetColor = '\x1b[0m'

  // Shuffle colors for random assignment
  const shuffleIndex = Math.floor(Math.random() * colors.length)

  // Create readers with colors
  let readers = sources.map((source, index) => ({
    reader: source.stream.getReader(),
    name: source.name,
    color: colors[(index + shuffleIndex) % colors.length],
    lineQueue: [] as string[], // Queue to hold lines from this reader
    promise: null as Promise<void> | null,
  }))

  while (readers.length) {
    for (const reader of readers) {
      if (reader.lineQueue.length !== 0) {
        // If there are lines in the queue, yield the next one
        const nextLine = reader.lineQueue.shift()!
        yield `${reader.color}${reader.name}${resetColor} | ${nextLine}\n`
        continue
      }
      reader.promise ??= (async () => {
        try {
          const result = await reader.reader.read()
          if (result.done) {
            readers = readers.filter((r) => r !== reader)
            return
          }
          const lines = result.value.trimEnd().split('\n')
          reader.lineQueue.push(...lines)
        } catch (error) {
          console.error(`Error reading logs from ${reader.name}:`, error)
          readers = readers.filter((r) => r !== reader)
        } finally {
          reader.promise = null
        }
      })()
    }
    await Promise.any(readers.map((reader) => reader.promise))
  }
}

// Utility function to create a ReadableStream from an AsyncGenerator
export function createReadableStreamFromAsyncGenerator<T>(generator: AsyncGenerator<T>): ReadableStream<T> {
  return new ReadableStream({
    async start(controller) {
      for await (const chunk of generator) {
        controller.enqueue(chunk)
      }
      // controller.close()
    },
  })
}
