import { ProjectLabels } from 'core/adapters/kubernetes/labels/project.ts'
import { ServerAuthContext, ServerKubeContext, ServerProjectContext } from '../mod.ts'

export async function createServerProjectContext(
  parentCtx: ServerAuthContext & ServerKubeContext,
  options: { id: string },
): Promise<ServerProjectContext> {
  const ownerId = parentCtx.auth.user.id

  const { items: [namespace] } = await parentCtx.kube.client['karmada'].CoreV1
    .getNamespaceList({
      labelSelector: `${ProjectLabels['Id']}=${options.id},${ProjectLabels['OwnerId']}=${ownerId}`,
    })
    .catch(async (error: Error) => {
      throw new Error(
        'An internal error occurred while fetching the project namespace. Please try again later.',
        {
          cause: error,
        }
      )
    })
  if (!namespace) {
    throw new Error(`Project with id ${options.id} not found for owner ${ownerId}`)
  }

  return {
    ...parentCtx,
    project: {
      id: options.id!,
      namespace: namespace.metadata!.name!,
      cluster: namespace.metadata!.labels?.[ProjectLabels['Cluster']]!,
    },
  }
}
