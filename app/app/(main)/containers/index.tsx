import ContainersTableScreen from 'app/components/ctnr-io/containers-table-screen.tsx'
import { useTRPC } from 'driver/trpc/client/expo/mod.tsx'
import { useQuery } from '@tanstack/react-query'

export default function ContainersScreen() {
  const trpc = useTRPC()

  const { data, isLoading } = useQuery(trpc.core.listQuery.queryOptions({
    output: 'raw',
    fields: ['basic', 'resources', 'replicas', 'routes', 'clusters'] // Only fetch what the table needs
  }))

  return <ContainersTableScreen data={(data as any) ?? []} isLoading={isLoading} />
}
