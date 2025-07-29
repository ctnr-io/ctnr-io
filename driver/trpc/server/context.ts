import "lib/utils.ts";
import { CreateWSSContextFnOptions } from "@trpc/server/adapters/ws";

import * as ws from "ws";
import { Buffer } from "node:buffer";
import { bypassWsWebSocketMessageHandler } from "lib/websocket.ts";
import { createAsyncGeneratorListener } from "lib/async-generator.ts";
import { ServerContext, Signals } from "ctx/mod.ts";
import { createServerContext } from "ctx/server/mod.ts";

export async function createTrpcServerContext(opts: CreateWSSContextFnOptions): Promise<ServerContext> {
  const ws = opts.res as ws.WebSocket;

  // Create a generator for terminal size events
  const terminalSizeGenerator = createAsyncGeneratorListener(
    ["terminal-size"] as const,
    (eventType, handler) => {
      bypassWsWebSocketMessageHandler(
        ws,
        (event) => {
          if (event instanceof Buffer) {
            try {
              const parsed = JSON.parse(Buffer.from(event).toString("utf-8"));
              if (parsed && parsed.type === eventType) {
                console.debug("Terminal size event received:", parsed.data);
                handler(parsed.data);
                return true;
              }
            } catch {
              // Ignore errors when trying to close the writer
            }
          }
          return false;
        },
      );
    },
    () => ws.close(),
    (_eventType, size) => size as { columns: number; rows: number },
  );

  // Create a generator for signal events
  const signalGenerator = createAsyncGeneratorListener(
    ["signal"],
    (eventType, handler) => {
      bypassWsWebSocketMessageHandler(
        ws,
        (event) => {
          if (event instanceof Buffer) {
            try {
              const parsed = JSON.parse(Buffer.from(event).toString("utf-8"));
              if (parsed && parsed.type === eventType) {
                handler(parsed.data);
                return true;
              }
            } catch {
              // Ignore JSON parsing errors
            }
          }
          return false;
        },
      );
    },
    () => ws.close(),
    (_eventType, signal) => signal as Signals,
  );

  const stdio = {
    stdin: new ReadableStream({
      start(controller) {
        bypassWsWebSocketMessageHandler(
          ws,
          (event) => {
            if (event instanceof Buffer) {
              try {
                const parsed = JSON.parse(Buffer.from(event).toString("utf-8"));
                if (parsed && parsed.type === "stdin") {
                  controller.enqueue(new TextEncoder().encode(parsed.data));
                  return true;
                }
                // Handle EOF signal (Ctrl+D) from client
                if (parsed && parsed.type === "stdin-eof") {
                  // Close the stream properly without closing the WebSocket
                  controller.close();
                  return true;
                }
              } catch {
                // Ignore JSON parsing errors
              }
            }
            return false;
          },
        );
      },
    }),
    stdout: new WritableStream({
      write(chunk) {
        // Send as a JSON object that can be parsed by the client
        ws.send(JSON.stringify({
          type: "stdout",
          data: Buffer.from(chunk).toString("utf-8"),
        }));
      },
    }),
    stderr: new WritableStream({
      write(chunk) {
        // Send as a JSON object that can be parsed by the client
        ws.send(JSON.stringify({
          type: "stderr",
          data: Buffer.from(chunk).toString("utf-8"),
        }));
      },
    }),
    exit: (code: number) => {
      // Send an exit code message to the client
      ws.send(JSON.stringify({
        type: "exit-code",
        code, // Default to 0 if no code is provided
      }));
    },
    setRaw: (value: boolean) => ws.send(JSON.stringify({ type: "set-raw", value })),
    signalChan: () => signalGenerator,
    terminalSizeChan: () => terminalSizeGenerator,
  };

  // const token = opts.req.headers["authorization"]?.replace("Bearer ", "")!;
  // Authenticate with Supabase
  try {
    // const user = await verifySupabaseToken(token);
    const session = opts.info.connectionParams as { accessToken: string; refreshToken: string } | undefined;
    if (!session) {
      throw new Error("Session is required from connectionParams");
    }
    return await createServerContext({
      ...session,
      stdio,
    });
  } catch (error) {
    console.error("Failed to verify Supabase token:", error);
    ws.close(1008, "Authentication failed");
    throw new Error("Authentication failed");
  }
}
