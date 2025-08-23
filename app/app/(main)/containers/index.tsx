'use dom'

import ContainersTableScreen from 'app/components/ctnr-io/containers-table-screen.tsx'
import { useTRPC } from 'driver/trpc/client/expo/mod.tsx'

export default function ContainersScreen() {
  const { data } = useTRPC().core.list.useSubscription([]) || {}

  return <ContainersTableScreen data={data || []} />
}
