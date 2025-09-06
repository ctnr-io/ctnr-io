import { ProjectContext } from '../mod.ts'

export function createProjectContext(): ProjectContext {
  return {
    project: {
      id: '',
      namespace: '',
      ownerId: '',
    },
  }
}
