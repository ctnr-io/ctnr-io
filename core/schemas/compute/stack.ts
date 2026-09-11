import { z } from 'zod'
import { ContainerName, Publish } from 'lib/api/schemas.ts'
import { VolumeMount } from 'core/schemas/storage/volume.ts'

/**
 * A single service within a Stack, e.g. ingested from a docker-compose.yaml file.
 */
export const StackService = z.object({
  image: z.string().min(1),
  env: z.array(
    z.string().regex(/^[A-Z_][A-Z0-9_]*=.*$/, 'Environment variables must follow format KEY=value with uppercase keys'),
  ).optional(),
  publish: z.array(Publish).optional(),
  volume: z.array(VolumeMount).optional(),
  depends_on: z.array(z.string()).optional(),
  networks: z.array(z.string()).optional(),
  restart: z.enum(['always', 'on-failure', 'never']).optional(),
})
export type StackService = z.infer<typeof StackService>

/**
 * A Stack: a named group of services, e.g. ingested from a docker-compose.yaml file.
 */
export const Stack = z.object({
  name: ContainerName,
  services: z.record(z.string(), StackService),
})
export type Stack = z.infer<typeof Stack>
