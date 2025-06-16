import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { appRouter } from "./router.ts";

export const trpcServer = createHTTPServer({
  // middleware: cors(),
  router: appRouter,
  createContext() {
    return {};
  },
})

trpcServer.listen(3000)