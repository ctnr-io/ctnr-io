export const createAsyncGeneratorListener = async function* <
  HandlerArgs extends unknown[],
  YieldValue,
  EventType,
>(
  eventType: EventType,
  addListener: (eventType: EventType, handler: (...args: HandlerArgs) => void) => void,
  removeListener: (eventType: EventType, handler: () => void) => void,
  yielder: (...args: HandlerArgs) => YieldValue,
): AsyncGenerator<YieldValue, void, unknown> {
  const resolvers = Promise.withResolvers<HandlerArgs>();
  const resolveHandler = (...args: HandlerArgs) => {
    // Resolve the current promise with the new values
    resolvers.resolve(args);
  };
  addListener(eventType, resolveHandler);
  try {
    while (true) {
      // Start by sending the current terminal size
      yield yielder(...await resolvers.promise);
      // then create a new promise for the next iteration
      const { promise, resolve, reject } = Promise.withResolvers<HandlerArgs>();
      resolvers.promise = promise;
      resolvers.resolve = resolve;
      resolvers.reject = reject;
    }
  } finally {
    removeListener(eventType, resolveHandler);
  }
};
