export interface Deferer {
	(fn: DefererCallback): void
	execute: () => Promise<void>
	// [Symbol.iterator](): Iterator<() => void | Promise<void>>;
}

interface DefererCallback {
	(): unknown | Promise<unknown>
}

export function createDeferer(): Deferer {
  const deferFns: Array<DefererCallback> = []
  const defer = (fn: DefererCallback) => deferFns.push(fn)
  defer.execute = async () => {
    for (const fn of deferFns.toReversed()) {
      try {
        await fn()
      } catch (error) {
        console.error('Error running deferred function:', error)
      }
    }
    deferFns.length = 0 // Clear the array after running
  }
  return defer 
}
