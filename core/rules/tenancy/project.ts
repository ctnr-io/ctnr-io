import { Project } from 'core/schemas/tenancy/mod.ts'

export enum ProjectNamespaceLabels {
	Id = 'ctnr.io/project-id',
	Name =  'ctnr.io/project-name',
	OwnerId = 'ctnr.io/owner-id',
	Cluster = 'ctnr.io/cluster',
}

export const createProjectNamespaceLabels = (project: Pick<Project, 'id' | 'name' | 'ownerId' | 'cluster'>)	: Record<ProjectNamespaceLabels, string> => ({
	[ProjectNamespaceLabels.Id]: project.id,
	[ProjectNamespaceLabels.Name]: project.name,
	[ProjectNamespaceLabels.OwnerId]: project.ownerId,
	[ProjectNamespaceLabels.Cluster]: project.cluster,
})