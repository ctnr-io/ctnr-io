/**
 * Terminal color helpers. No-op when stdout isn't a TTY or NO_COLOR is set,
 * so JSON/piped output and the MCP stdio transport never see ANSI codes.
 */
import * as fmt from '@std/fmt/colors'

const enabled = Deno.stdout.isTerminal() && !Deno.noColor

function wrap(fn: (s: string) => string) {
  return (s: string) => enabled ? fn(s) : s
}

export const bold = wrap(fmt.bold)
export const dim = wrap(fmt.dim)
export const red = wrap(fmt.red)
export const green = wrap(fmt.green)
export const yellow = wrap(fmt.yellow)
export const cyan = wrap(fmt.cyan)

const STATUS_COLORS: Record<string, (s: string) => string> = {
  running: green,
  active: green,
  ready: green,
  succeeded: green,
  pending: yellow,
  starting: yellow,
  progressing: yellow,
  stopped: dim,
  unknown: dim,
  failed: red,
  error: red,
  crashloopbackoff: red,
}

/**
 * Color a status word (e.g. a table STATUS column) by its semantic meaning.
 * Matches on the trimmed, lowercased text so a caller may pass an already
 * padded/whitespace-padded value without breaking the lookup.
 */
export function colorStatus(status: string): string {
  const color = STATUS_COLORS[status.trim().toLowerCase()] ?? ((s: string) => s)
  return color(status)
}

const LINE_PREFIX_COLORS: [prefix: string, color: (s: string) => string][] = [
  ['❌', red],
  ['⚠️', yellow],
  ['✅', green],
]

/**
 * Color a handler-emitted status line by its leading emoji convention
 * (❌ error, ⚠️ warn, ✅ success). Lines without a recognized prefix pass through.
 */
export function colorStatusLine(line: string): string {
  for (const [prefix, color] of LINE_PREFIX_COLORS) {
    if (line.startsWith(prefix)) return color(line)
  }
  return line
}
