/**
 * Progress/step feedback for long-running commands. Writes to stderr so
 * `--output json|yaml|name` on stdout stays byte-identical. No-op when stderr
 * isn't a TTY (piped, or the MCP stdio transport, which pipes stderr) - gated
 * on stderr rather than stdout like lib/api/colors.ts, since that's where this
 * writes. NO_COLOR drops the ANSI codes only; the lines themselves still print.
 */
import * as fmt from '@std/fmt/colors'

const enabled = Deno.stderr.isTerminal()
const encoder = new TextEncoder()

function write(s: string): void {
  Deno.stderr.writeSync(encoder.encode(s))
}

function colorize(line: string): string {
  if (Deno.noColor) return line
  if (line.startsWith('❌')) return fmt.red(line)
  if (line.startsWith('⚠️')) return fmt.yellow(line)
  if (line.startsWith('✅')) return fmt.green(line)
  return line
}

/** Print one status line to stderr. No-op when progress output is disabled. */
export function step(message: string): void {
  if (!enabled) return
  write(`${colorize(message)}\n`)
}
