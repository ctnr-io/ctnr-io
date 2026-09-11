import { assertThrows } from '@std/assert'
import { StackService } from './stack.ts'

Deno.test('StackService.env accepts uppercase, lowercase, and mixed-case keys', () => {
  StackService.parse({
    image: 'ghost:5-alpine',
    env: [
      'NODE_ENV=production',
      'database__connection__host=db',
      'url=http://example.com',
      'mail__transport=SMTP',
      'PORT=3000',
    ],
  })
})

Deno.test('StackService.env rejects an entry with no "=" separator', () => {
  assertThrows(
    () => StackService.parse({ image: 'alpine:3', env: ['NOVALUE'] }),
    Error,
  )
})

Deno.test('StackService.env rejects a key starting with a digit', () => {
  assertThrows(
    () => StackService.parse({ image: 'alpine:3', env: ['1KEY=value'] }),
    Error,
  )
})

Deno.test('StackService.env accepts an empty value', () => {
  StackService.parse({ image: 'alpine:3', env: ['KEY='] })
})
