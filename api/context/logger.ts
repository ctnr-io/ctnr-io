import { TerminalLoadMessage } from 'lib/api/types.ts'

export type LoggerContext = {
  log: {
    loader: (value?: string) => TerminalLoadMessage
  }
}

export function createLoggerContext(): LoggerContext {
  return {
    log: {
      loader: (value?: string) => ({
        type: 'load',
        value,
      }),
    },
  }
}
