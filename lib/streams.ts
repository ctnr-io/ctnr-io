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
      tunnel.stdout
        .pipeTo(ctx.stdio.stdout, {
          signal,
          preventAbort: true,
          preventCancel: true,
          preventClose: true,
        })
        .catch(console.debug),
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
        })
        .catch(console.debug),
    )
  }

  if (tunnel.stdin) {
    streamPromises.push(
      ctx.stdio.stdin
        .pipeThrough(handleCtrlPCtrlQStream)
        .pipeTo(interactive ? tunnel.stdin : new WritableStream()).catch(console.debug),
    )
  }

  // Wait for any stream to complete
  const result = await Promise.any(streamPromises)

  console.debug(`Stream processing completed with result:`, result)
}

export async function* combineReadableStreamsToGenerator(
  sources: { stream: ReadableStream<string>; name: string }[],
): AsyncIterable<string> {
  // Extended color palette for pod names (like docker-compose)
  const colors = [
    '\x1b[36m', // cyan
    '\x1b[32m', // green
    '\x1b[33m', // yellow
    '\x1b[35m', // magenta
    '\x1b[34m', // blue
    '\x1b[31m', // red
    '\x1b[96m', // bright cyan
    '\x1b[92m', // bright green
    '\x1b[93m', // bright yellow
    '\x1b[95m', // bright magenta
    '\x1b[94m', // bright blue
    '\x1b[91m', // bright red
  ]
  const reset = '\x1b[0m'

  // Shuffle colors for random assignment
  const shuffledColors = [...colors].sort(() => Math.random() - 0.5)

  // Create readers with colors
  let readers = sources.map((source, index) => ({
    reader: source.stream.getReader(),
    name: source.name,
    color: shuffledColors[index % shuffledColors.length],
    lineQueue: [] as string[], // Queue to hold lines from this reader
    done: false,
    promise: null as Promise<void> | null,
  }))

  while (readers.length) {
    for (const reader of readers) {
      if (reader.lineQueue.length !== 0) {
        // If there are lines in the queue, yield the next one
        const nextLine = reader.lineQueue.shift()!
        yield `${reader.color}${reader.name}${reset} | ${nextLine}\n`
        // round robin through readers to ensure fairness
        readers.push(readers.shift()!)
        continue
      }
    }
    for (const reader of readers) {
      if (reader.lineQueue.length === 0 && reader.done) {
        readers = readers.filter((r) => r !== reader)
        continue
      }
    }
    for (const reader of readers) {
      if (!reader.promise) {
        reader.promise = (async () => {
          try {
            const result = await reader.reader.read()
            if (result.done) {
              reader.done = true
              return
            }
            const lines = result.value.trimEnd().split('\n')
            reader.lineQueue.push(...lines)
          } catch (error) {
            console.error(`Error reading logs from ${reader.name}:`, error)
            reader.done = true
          } finally {
            reader.promise = null
          }
        })()
      }
    }
    if (
      readers.length > 0 && readers.every((reader) => reader.lineQueue.length === 0 && !reader.done && reader.promise)
    ) {
      await Promise.race(readers.map((reader) => reader.promise))
    }
  }
}

// Utility function to create a ReadableStream from an AsyncIterable
export function createReadableStreamFromAsyncGenerator<T>(iterable: AsyncIterable<T>): ReadableStream<T> {
  return new ReadableStream({
    async start(controller) {
      for await (const chunk of iterable) {
        controller.enqueue(chunk)
      }
      controller.close()
    },
  })
}
