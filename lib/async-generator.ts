export async function* createAsyncGeneratorListener<
  HandlerArgs extends unknown[],
  YieldValue,
  EventType,
>(
  eventTypes: EventType[],
  addListener: (eventType: EventType, handler: (...args: HandlerArgs) => void) => void,
  removeListener: (eventType: EventType, handler: () => void) => void,
  yielder: (eventType: EventType, ...args: HandlerArgs) => YieldValue,
): AsyncGenerator<YieldValue, void, unknown> {
  const resolvers = Promise.withResolvers<[EventType, HandlerArgs]>()
  const resolveHandler = (eventType: EventType) => (...args: HandlerArgs) => {
    // Resolve the current promise with the new values
    resolvers.resolve([eventType, args])
  }
  for (const eventType of eventTypes) {
    addListener(eventType, resolveHandler(eventType))
  }
  try {
    while (true) {
      // Start by sending the current terminal size
      const [eventType, args] = await resolvers.promise
      yield yielder(eventType, ...args)
      // then create a new promise for the next iteration
      const { promise, resolve, reject } = Promise.withResolvers<[EventType, HandlerArgs]>()
      resolvers.promise = promise
      resolvers.resolve = resolve
      resolvers.reject = reject
    }
  } finally {
    for (const eventType of eventTypes) {
      // Clean up by removing the listener for each event type
      removeListener(eventType, resolveHandler(eventType))
    }
  }
}
