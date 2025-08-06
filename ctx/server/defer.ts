import { DeferServerContext } from "../mod.ts";

export function createDeferServerContext(): DeferServerContext {
  const deferFns: Array<() => any> = [];
  const defer = (fn: () => any) => deferFns.push(fn);
	defer.run = async () => {
		for (const fn of deferFns.toReversed()) {
			try {
				await fn();
			} catch (error) {
				console.error("Error running deferred function:", error);
			}
		}
		deferFns.length = 0; // Clear the array after running
	};
  return {
    defer,
	}
}
