export type Context = {
  signal: AbortSignal | undefined;
  // defer: (fn: () => void) => void;
};

export type Signals =
  | "SIGINT"
  | "SIGQUIT"

export type StdioContext = Context & {
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

export const namespace = "ctnr-edge" as const;