import { KubeClient } from "lib/kube-client.ts";

export type SignalContext = {
  signal: AbortSignal | undefined;
  // defer: (fn: () => void) => void;
};

export type Signals =
  | "SIGINT"
  | "SIGQUIT";

export type StdioContext = {
  stdio: {
    stdin: ReadableStream;
    stdout: WritableStream;
    stderr: WritableStream;
    exit: (code: number) => void;
    setRaw: (value: boolean) => void;
    signalChan: () => AsyncGenerator<Signals, void, unknown>;
    terminalSizeChan: () => AsyncGenerator<{ columns: number; rows: number }, void, unknown>;
  };
};

export type KubernetesContext = {
  kube: {
    client: KubeClient;
  };
};

export const namespace = "ctnr-edge" as const;

export type ServerContext = SignalContext & StdioContext & KubernetesContext;
export type ClientContext = SignalContext & StdioContext;
