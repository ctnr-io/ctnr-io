import { KubeClient } from "lib/kube-client.ts";
import { Session, SupportedStorage, User } from "@supabase/supabase-js";

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

export type AuthContext = {
  auth: {
    session: Session | null;
  }
};

export const namespace = "ctnr-edge" as const;

export type ServerContext = SignalContext & StdioContext & KubernetesContext & AuthContext;
export type ClientContext = SignalContext & StdioContext & AuthContext;
