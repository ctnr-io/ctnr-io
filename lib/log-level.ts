import { match } from 'ts-pattern'

enum LogLevel {
  Info = 2,
  Warn = 3,
  Error = 4,
}

const logLevel = match(process.env.LOG_LEVEL)
  .with('info', () => LogLevel.Info)
  .with('warn', () => LogLevel.Warn)
  .with('error', () => LogLevel.Error)
  .otherwise(() => LogLevel.Info)

globalThis.console = {
  ...console,
  debug: process.env.DEBUG === 'true' ? console.debug : () => {},
  info: logLevel <= LogLevel.Info ? console.info : () => {},
  warn: logLevel <= LogLevel.Warn ? console.warn : () => {},
  error: logLevel <= LogLevel.Error ? console.error : () => {},
}
