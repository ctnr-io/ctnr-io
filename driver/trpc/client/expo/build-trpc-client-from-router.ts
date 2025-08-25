import { isObservable, observable, observableToAsyncIterable } from '@trpc/server/observable'
import { AnyRouter, callTRPCProcedure, TRPCError } from '@trpc/server'
import { isAsyncIterable } from '@trpc/server/unstable-core-do-not-import'
import { createTRPCClient, TRPCLink } from '@trpc/client'

export function buildTrpcClientFromRouter<AppRouter extends AnyRouter>(router: AppRouter, ctx: any) {
  function mockLink<TRouter extends AnyRouter>(): TRPCLink<TRouter> {
    return () => {
      return ({ op }) => {
        return observable((observer) => {
          const handler = async () => {
            const result = await callTRPCProcedure({
							router: router,
              ctx,
              path: op.path,
              input: op.input,
              getRawInput: async () => op.input,
              type: op.type,
              signal: op.signal as AbortSignal | undefined,
            });

            const isIterableResult = isAsyncIterable(result) || isObservable(result);

            if (op.type !== 'subscription') {
              if (isIterableResult) {
                throw new TRPCError({
                  code: 'BAD_REQUEST',
                  message: 'Cannot return an async iterable in a non-subscription call',
                });
              }
              observer.next({
                result: {
                  type: 'data',
                  data: result,
                },
                context: op.context,
              });
              observer.complete();
            } else {
              if (!isIterableResult) {
                throw new TRPCError({
                  code: 'BAD_REQUEST',
                  message: 'Cannot return a non-async iterable in a subscription call',
                });
              }

              const iterable = isObservable(result) ? observableToAsyncIterable(result, op.signal as AbortSignal) : result;
              for await (const item of iterable) {
                if (op.signal?.aborted) {
                  break;
                }

                observer.next({
                  result: {
                    type: 'data',
                    data: item,
                  },
                  context: op.context,
                });
              }
              observer.complete();
            }
          };

          void handler();

          return () => {
            observer.complete();
          };
        });
      };
    };
  }

  const trpcClient = createTRPCClient<AppRouter>({
    links: [mockLink()],
  });

  return trpcClient;
}
