import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ClusterName, Name, Project } from 'lib/api/schemas.ts'

export const Meta = {
  aliases: {
    options: {
      output: 'o',
    },
  },
}

export const Input = z.object({
	name: Name.optional(), // Filter by specific project name
})

export type Input = z.infer<typeof Input>

/**
 * List all projects for the user.
 * 
 * 0. Fetch all namespaces representing projects in a specific Kubernetes cluster.
 * 1. Filter by name if provided.
 * 2. Return the list of projects.
 */
export default async function* listProjects(
  { ctx, input, signal }: ServerRequest<Input>,
): ServerResponse<Project[]> {

	const kubeClient = ctx.kube.client['karmada']

	// 0. Fetch all namespaces representing projects in a specific Kubernetes cluster.
	const namespaces = await kubeClient.CoreV1.getNamespaceList({
		labelSelector: 'ctnr.io/owner-id=' + ctx.auth.user.id,
		abortSignal: signal,
	})

	// 1. Filter by name if provided.
	const filteredNamespaces = input.name
		? namespaces.items.filter(ns => ns.metadata?.labels?.['ctnr.io/project-name'] === input.name)
		: namespaces.items

	// 2. Transform namespaces to projects
	const projects: Project[] = filteredNamespaces.map(ns => ({
		id: ns.metadata?.labels?.['ctnr.io/project-id'] || '',
		name: ns.metadata?.labels?.['ctnr.io/project-name'] || '',
		ownerId: ns.metadata?.labels?.['ctnr.io/owner-id'] || '',
		clusterName: (ns.metadata?.labels?.['ctnr.io/cluster-name'] || '') as ClusterName,
	}))

	return projects
}
