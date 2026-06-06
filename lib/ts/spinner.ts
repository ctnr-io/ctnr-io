
export class Spinner {
  private readonly frames = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷']
  private index = 0
  private message = ''
  private timer: ReturnType<typeof setInterval> | undefined
  private readonly encoder = new TextEncoder()

  start(message?: string) {
    if (message) {
      // Add a dot in the end if not already present for better UX
      this.message = message.endsWith('.') ? message : `${message}...`
    } else {
      this.message = ''
    }
    if (this.timer) {
      return
    }
    this.render()
    this.timer = setInterval(() => this.render(), 300)
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
      Deno.stderr.writeSync(this.encoder.encode('\r\x1b[2K\r'))
    }
  }

  private render() {
    const frame = this.frames[this.index % this.frames.length]
    this.index += 1
    Deno.stderr.writeSync(this.encoder.encode(`\r\x1b[2K${frame} ${this.message}`))
  }
}
