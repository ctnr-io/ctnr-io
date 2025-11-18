import { Project } from './schemas.ts'


export type ProjectLabels = {
	'project.ctnr.io/id': string,
	'project.ctnr.io/name': string,
	'project.ctnr.io/owner-id': string,
}

export const createProjectLabels = (project: Project)	: ProjectLabels => ({
	'project.ctnr.io/id': project.id,
	'project.ctnr.io/name': project.name,
	'project.ctnr.io/owner-id': project.ownerId,
})