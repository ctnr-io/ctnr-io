import { assertEquals, assertThrows } from '@std/assert'
import { composeToStack, parseComposeFile, parsePort, sanitizeName } from './compose.ts'

const MULTI_SERVICE_COMPOSE = `
name: my-app
services:
  web:
    image: nginx:1.27
    ports:
      - "8080:80"
      - "443:443/tcp"
    environment:
      NODE_ENV: production
      API_URL: http://api:3000
    depends_on:
      - api
    networks:
      - frontend
    volumes:
      - assets:/usr/share/nginx/html:5G
    restart: always
  api:
    image: my-registry/api:1.2.3
    environment:
      - DATABASE_URL=postgres://db:5432/app
      - PORT=3000
    depends_on:
      db:
        condition: service_healthy
    networks:
      - frontend
      - backend
    restart: on-failure
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: secret
      database__connection__host: db
    volumes:
      - db-data:/var/lib/postgresql/data:10G
    networks:
      - backend
    restart: unless-stopped
`

Deno.test('parseComposeFile maps a realistic multi-service compose file to a Stack', () => {
  const stack = parseComposeFile(MULTI_SERVICE_COMPOSE, 'fallback-name')

  assertEquals(stack.name, 'my-app')
  assertEquals(Object.keys(stack.services).sort(), ['api', 'db', 'web'])

  const web = stack.services.web
  assertEquals(web.image, 'nginx:1.27')
  assertEquals(web.publish?.map(String), ['80/tcp', '443/tcp'])
  assertEquals(web.env, ['NODE_ENV=production', 'API_URL=http://api:3000'])
  assertEquals(web.volume, ['assets:/usr/share/nginx/html:5G'])
  assertEquals(web.depends_on, ['api'])
  assertEquals(web.networks, ['frontend'])
  assertEquals(web.restart, 'always')

  const api = stack.services.api
  assertEquals(api.env, ['DATABASE_URL=postgres://db:5432/app', 'PORT=3000'])
  assertEquals(api.depends_on, ['db'])
  assertEquals(api.networks, ['frontend', 'backend'])
  assertEquals(api.restart, 'on-failure')

  const db = stack.services.db
  assertEquals(db.env, ['POSTGRES_PASSWORD=secret', 'database__connection__host=db'])
  assertEquals(db.volume, ['db-data:/var/lib/postgresql/data:10G'])
  assertEquals(db.networks, ['backend'])
  // unless-stopped maps to ctnr's closest equivalent, always
  assertEquals(db.restart, 'always')
})

Deno.test('parsePort drops the host side and defaults to tcp', () => {
  assertEquals(parsePort('8080:80'), '80/tcp')
  assertEquals(parsePort('8080:80/tcp'), '80/tcp')
  assertEquals(parsePort('53/udp'), '53/udp')
  assertEquals(parsePort(80), '80/tcp')
})

Deno.test('composeToStack falls back to the given default name when the file has none', () => {
  const stack = composeToStack({ services: { app: { image: 'alpine:3' } } }, 'My Cool Stack')
  assertEquals(stack.name, 'my-cool-stack')
  assertEquals(stack.services.app.image, 'alpine:3')
})

Deno.test('composeToStack rejects services without an image (build-only services)', () => {
  assertThrows(
    () => composeToStack({ services: { app: { build: '.' } } }, 'stack'),
    Error,
    'missing an "image"',
  )
})

Deno.test('composeToStack rejects a document without a services map', () => {
  assertThrows(() => composeToStack({ name: 'stack' }, 'stack'), Error, 'missing "services"')
})

Deno.test('sanitizeName normalizes arbitrary compose project names', () => {
  assertEquals(sanitizeName('My Cool Stack!'), 'my-cool-stack')
  assertEquals(sanitizeName('already-valid'), 'already-valid')
})
