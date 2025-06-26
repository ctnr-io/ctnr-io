import * as ws from "ws";

/**
 * Bypass the default `onmessage` handler to allow custom handling of messages
 * @param WebSocket The WebSocket instance to upgrade
 * @param handler Custom handler for the event
 * @returns The upgraded WebSocket instance
 */
export function bypassWebSocketMessageHandler<T>(
  ws: WebSocket,
  handler: (event: MessageEvent) => boolean,
) {
  const originalOnMessage = ws.onmessage;
  ws.onmessage = (event: MessageEvent) => {
    if (!handler(event)) {
      return originalOnMessage?.call(ws, event);
    }
  };
  return ws;
}

/**
 * Bypass the default `onmessage` handler to allow custom handling of messages
 * @param ws The ws.WebSocket instance to upgrade
 * @param handler Custom handler for the event
 * @returns The upgraded WSClient instance
 */
export function bypassWsWebSocketMessageHandler(
  ws: ws.WebSocket,
  upgrader: (event: ws.RawData) => boolean,
): void {
  // Bypass trpc websocket message handler, before it tries to parse event for procedures
  // 1. First prevent trpc handling message by removing all existing trpc handlers from WS connection
  const originalMessageHandlers = ws.listeners("message").map((messageHandler) => {
    ws.removeListener("message", messageHandler as (data: ws.RawData, isBinary: boolean) => void);
    return messageHandler;
  });
  // 2. Then add a new message handler that handles stdin messages first
  ws.addListener("message", (event) => {
    if (!upgrader(event)) {
      // 3. If the message is not handled, fall back to the default handlers
      originalMessageHandlers.forEach((messageHandler) => messageHandler(event));
    }
  });
}
