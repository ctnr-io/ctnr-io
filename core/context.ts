import { create } from "node:domain";

export type Context = {
	signal?: AbortSignal;
	// defer: (fn: () => void) => void;
}

export type AttachableContext = Context & {
	stdin: ReadableStream;
	stdout: WritableStream;
	stderr: WritableStream;
}

const createDefer = (context: Context) => {
	const deferred: (() => void)[] = [];
	// context.defer = (fn: () => void) => {
		// deferred.push(fn);
	// };
	return () => {
		for (const fn of deferred) {
			fn();
		}
	};
}

export const createContext = ({ signal }: { signal?: AbortSignal }): Context => {
	return {
		signal,
	}
};