export type Context = {
  signal: AbortSignal | undefined;
  // defer: (fn: () => void) => void;
};

export type StdioContext = Context & {
  stdio: {
    stdin: ReadableStream;
    stdout: WritableStream;
    stderr: WritableStream;
    terminalSizeChan: () => AsyncGenerator<{ columns: number; rows: number }, void, unknown>;
  };
};
