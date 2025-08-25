import ContainersTableScreen from 'app/components/ctnr-io/containers-table-screen.tsx'
import { useExpoTrpcClientContext, useTRPC } from 'driver/trpc/client/expo/mod.tsx'

export default function ContainersScreen() {
  const ctx = useExpoTrpcClientContext()
  console.log({ ctx })
  ctx.connect((server) => {
    // Do something with the server
    server.core.list.subscribe()
  })
  return <ContainersTableScreen data={ []} />
}
