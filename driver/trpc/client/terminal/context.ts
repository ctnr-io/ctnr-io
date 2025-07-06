import { ClientContext } from "../../../../ctx/mod.ts";
import { Buffer } from "node:buffer";
import { bypassWebSocketMessageHandler } from "lib/websocket.ts";
import { TRPCClient } from "@trpc/client";
import { ServerRouter } from "../../server/router.ts";
import { createTRPCWebSocketClient } from "../mod.ts";
import { createClientContext } from "ctx/client/mod.ts";
import loginPkce from "api/client/auth/login-pkce.ts";

type ProcedureOptions = {
  authenticate: boolean;
};

export type ClientTerminalContext = ClientContext & {
  lazy: <R>(
    procedureOptions: ProcedureOptions,
    callback: ({ server }: {
      server: TRPCClient<ServerRouter>;
    }) => Promise<R>,
  ) => Promise<R>;
};

export async function createTrpcClientTerminalContext(
  opts: {
    stdio: ClientContext["stdio"];
  },
): Promise<ClientTerminalContext> {
  const ctx = await createClientContext(opts);
  return {
    ...ctx,
    // This function prevent to start websocket connection until the first call to `lazy`
    // This is useful to avoid unnecessary WebSocket connections when running commands that do not require it like --help.
    lazy: async (procedureOptions, callback) => {
      try {
        await loginPkce({ ctx })
        const { data: { session } } = await ctx.auth.client.getSession();
        if (!session) {
          throw new Error("Failed to retrieve session. Please log in again.");
        }
        const client = await createTRPCWebSocketClient({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
        });

        opts.stdio.stdin.pipeTo(
          new WritableStream({
            write(chunk) {
              // Forward stdin data to the WebSocket as a JSON object
              client.websocket.connection?.ws.send(JSON.stringify({
                type: "stdin",
                data: Buffer.from(chunk).toString("utf-8"),
              }));
            },
            close() {
              console.log("Stdin stream closed, sending EOF to server.");
              // Send a message to the WebSocket to indicate that stdin has reached EOF (Ctrl+D)
              // Instead of closing the connection, we send a special message
              client.websocket.connection?.ws.send(JSON.stringify({
                type: "stdin-eof",
              }));
            },
          }),
        );

        bypassWebSocketMessageHandler(
          client.websocket.connection!.ws,
          (event) => {
            try {
              const parsed = JSON.parse(event.data);
              if (parsed.type === "stdout") {
                const stdoutWriter = opts.stdio.stdout.getWriter();
                stdoutWriter.write(new TextEncoder().encode(parsed.data));
                stdoutWriter.releaseLock();
                return true;
              }
              if (parsed.type === "stderr") {
                const stderrWriter = opts.stdio.stderr.getWriter();
                stderrWriter.write(new TextEncoder().encode(parsed.data));
                stderrWriter.releaseLock();
                return true;
              }
              if (parsed.type === "set-raw") {
                opts.stdio.setRaw(parsed.value);
                return true;
              }
              if (parsed.type === "exit-code") {
                // Handle exit code message from server
                // Exit the process with the received exit code
                opts.stdio.exit(parsed.code);
                return true;
              }
            } catch (e) {
            }
            return false;
          },
        );

        while (!client.websocket.connection?.state || client.websocket.connection?.state !== "open") {
          // Wait for the WebSocket connection to be established
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        (async () => {
          for await (const signal of opts.stdio.signalChan()) {
            client.websocket.connection?.ws.send(JSON.stringify({
              type: "signal",
              data: signal,
            }));
          }
        })();

        (async () => {
          for await (const terminalSize of opts.stdio.terminalSizeChan()) {
            client.websocket.connection?.ws.send(JSON.stringify({
              type: "terminal-size",
              data: terminalSize,
            }));
          }
        })();

        return callback({
          server: client.trpc,
        });
      } catch (error) {
        console.debug("Error in lazy callback:", error);
        console.error(error instanceof Error ? error.message : "An error occurred while executing command.");
        Deno.exit(1);
      }
    },
  };
}
