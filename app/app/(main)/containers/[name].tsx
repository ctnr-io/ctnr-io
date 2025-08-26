import { useTRPC } from 'driver/trpc/client/expo/mod.tsx'
import { useQuery } from '@tanstack/react-query'
import { Redirect } from 'expo-router'
import { useLocalSearchParams } from 'expo-router'
import { ContainersDetailScreen } from 'app/components/ctnr-io/containers-detail-screen.tsx'

export default function () {
  const { name } = useLocalSearchParams<{ name: string }>()
  const trpc = useTRPC()

  // Fetch container data using the name parameter
  const { data: containers, isLoading, error } = useQuery(
    trpc.core.listQuery.queryOptions({
      output: 'raw',
      name: name as string,
      fields: ['all'], // Detail view needs all data including config and metrics
    }),
  )

  // Get the first container from the results (should be only one with name filter)
  const containerData = (containers as any)?.[0]

  if (!containerData && error) {
    return <Redirect href='/containers' />
  }

  return <ContainersDetailScreen data={containerData} isLoading={isLoading} />
}
