import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import z from 'zod'
import { ResourceLimits } from 'core/rules/billing/utils.ts'
import { setLimits, type UsageContext } from 'core/data/billing/usage.ts'

export const Meta = {}

export const Input = z.object({
  cpu: z.union([z.string().regex(/^\d+$/)]).refine(
    (val) => {
      const cpuValue = ResourceLimits.cpu.fromString(val)
      return cpuValue >= ResourceLimits.cpu.min && cpuValue <= ResourceLimits.cpu.max
    },
    `CPU limit must be between ${ResourceLimits.cpu.display(ResourceLimits.cpu.min)} and ${
      ResourceLimits.cpu.display(ResourceLimits.cpu.max)
    }`,
  ).describe('CPU limit'),
  memory: z.string().regex(/^\d+G/).refine(
    (val) => {
      const memoryValue = ResourceLimits.memory.fromString(val)
      return memoryValue >= ResourceLimits.memory.min && memoryValue <= ResourceLimits.memory.max
    },
    `Memory limit must be between ${ResourceLimits.memory.display(ResourceLimits.memory.min)} and ${
      ResourceLimits.memory.display(ResourceLimits.memory.max)
    }`,
  ).describe('Memory limit'),
  storage: z.string().regex(/^\d+[GT]/).refine(
    (val) => {
      const storageValue = ResourceLimits.storage.fromString(val)
      return storageValue >= ResourceLimits.storage.min && storageValue <= ResourceLimits.storage.max
    },
    `Storage limit must be between ${ResourceLimits.storage.display(ResourceLimits.storage.min)} and ${
      ResourceLimits.storage.display(ResourceLimits.storage.max)
    }`,
  ).describe('Storage limit'),
})
export type Input = z.infer<typeof Input>

export type Output = void

export default async function* (
  request: ServerRequest<Input>,
): ServerResponse<Output> {
  const { ctx, input, signal } = request

  const usageCtx: UsageContext = {
    kubeClient: ctx.kube.client['karmada'],
    namespace: ctx.project.namespace,
  }

  await setLimits(usageCtx, {
    cpu: input.cpu,
    memory: input.memory,
    storage: input.storage,
  }, signal)
}
