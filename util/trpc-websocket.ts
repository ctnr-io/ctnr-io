import { createWSClient } from "@trpc/client";
import * as ws from "ws";

export type WSClient = ReturnType<typeof createWSClient>;

/**
 * Upgrade a WSClient to handle specific events with a predicate.
 * Bypass the default `onmessage` handler to allow custom handling of messages
 * @param wsClient The WSClient instance to upgrade
 * @param predicate Check if the event should be handled by the custom handler
 * @param handler Custom handler for the event
 * @returns The upgraded WSClient instance
 */
export function upgradeWSClient<T>(
  wsClient: WSClient,
  upgrader: (event: any) => boolean,
) {
  const originalOnMessage = wsClient.connection!.ws.onmessage;
  wsClient.connection!.ws.onmessage = (event: MessageEvent) => {
    if (!upgrader(event)) {
      return originalOnMessage?.call(wsClient.connection!.ws, event);
    }
  };
}

export function upgradeWSSWebSocket(
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
