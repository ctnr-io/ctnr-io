import { match } from 'ts-pattern'

enum LogLevel {
	None = 0,
	Debug = 1,
	Info = 2,
	Warn = 3,
	Error = 4,
}

const logLevel = match(Deno.env.get("LOG_LEVEL"))
	.with("none", () => LogLevel.None)
	.with("debug", () => LogLevel.Debug)
	.with("info", () => LogLevel.Info)
	.with("warn", () => LogLevel.Warn)
	.with("error", () => LogLevel.Error)
	.otherwise(() => LogLevel.Info);

globalThis.console = {
	...console,
	debug: logLevel >= LogLevel.Debug ? console.debug : () => {},
	info: logLevel >= LogLevel.Info ? console.info : () => {},
	warn: logLevel >= LogLevel.Warn ? console.warn : () => {},
	error: logLevel >= LogLevel.Error ? console.error : () => {},
}