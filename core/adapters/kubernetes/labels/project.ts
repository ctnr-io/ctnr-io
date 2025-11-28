import { Project } from 'core/entities/tenancy/mod.ts'

export enum ProjectLabels {
	Id = 'project.ctnr.io/id',
	Name =  'project.ctnr.io/name',
	OwnerId = 'project.ctnr.io/owner-id',
	Cluster = 'project.ctnr.io/cluster',
}

export const createProjectLabels = (project: Pick<Project, 'id' | 'name' | 'ownerId' | 'cluster'>)	: Record<ProjectLabels, string> => ({
	[ProjectLabels.Id]: project.id,
	[ProjectLabels.Name]: project.name,
	[ProjectLabels.OwnerId]: project.ownerId,
	[ProjectLabels.Cluster]: project.cluster,
})