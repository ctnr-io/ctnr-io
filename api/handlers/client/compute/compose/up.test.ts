import { assertEquals, assertThrows } from '@std/assert'
import { sortByDependencies } from './up.ts'
import type { Stack } from 'core/schemas/compute/stack.ts'

function service(overrides: Partial<Stack['services'][string]> = {}): Stack['services'][string] {
  return { image: 'alpine:3', ...overrides }
}

Deno.test('sortByDependencies orders a single dependency before its dependent (ghost -> db)', () => {
  const services: Stack['services'] = {
    ghost: service({ depends_on: ['db'] }),
    db: service(),
  }
  assertEquals(sortByDependencies(services), ['db', 'ghost'])
})

Deno.test('sortByDependencies orders a shared dependency before all of its dependents (supabase -> db)', () => {
  const services: Stack['services'] = {
    auth: service({ depends_on: ['db'] }),
    rest: service({ depends_on: ['db'] }),
    db: service(),
  }
  const order = sortByDependencies(services)
  assertEquals(order.indexOf('db') < order.indexOf('auth'), true)
  assertEquals(order.indexOf('db') < order.indexOf('rest'), true)
  assertEquals(order.length, 3)
})

Deno.test('sortByDependencies throws on a circular dependency', () => {
  const services: Stack['services'] = {
    a: service({ depends_on: ['b'] }),
    b: service({ depends_on: ['a'] }),
  }
  assertThrows(() => sortByDependencies(services), Error, 'Circular dependency detected')
})
