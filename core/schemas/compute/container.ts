import { z } from 'zod'
import { ResourceQuantities } from '../common.ts'
import { Command } from 'lib/api/schemas.ts'

/**
 * Container port configuration
 */
export const ContainerPort = z.object({
  name: z.string().optional(),
  number: z.number().min(1).max(65535),
  protocol: z.enum(['tcp', 'udp']).default('tcp'),
})
export type ContainerPort = z.infer<typeof ContainerPort>

/**
 * Container instance (pod) information
 */
export const ContainerInstance = z.object({
  name: z.string(),
  status: z.string(),
  createdAt: z.date(),
  cpu: z.string(),
  memory: z.string(),
  restarts: z.number().optional(),
  node: z.string().optional(),
})
export type ContainerInstance = z.infer<typeof ContainerInstance>

/**
 * Container status enum matching Docker states
 */
export const ContainerStatus = z.enum([
  'created',
  'restarting',
  'running',
  'removing',
  'paused',
  'exited',
  'dead',
])
export type ContainerStatus = z.infer<typeof ContainerStatus>

/**
 * Container state object matching Docker's State structure
 * Provides detailed runtime state information compatible with dockerode
 */
export const ContainerState = z.object({
  // Status string (matches ContainerStatus enum)
  status: ContainerStatus,
  
  // State flags (Docker-compatible)
  running: z.boolean(),
  paused: z.boolean(),
  restarting: z.boolean(),
  oomKilled: z.boolean(),
  dead: z.boolean(),
  
  // Exit information
  exitCode: z.number().optional(),
  error: z.string().optional(),
  
  // Timestamps
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  
  // Additional Kubernetes-specific information
  reason: z.string().optional().describe('Kubernetes waiting/termination reason'),
  message: z.string().optional().describe('Kubernetes state message'),
})
export type ContainerState = z.infer<typeof ContainerState>

/**
 * Environment variable configuration
 */
export const EnvVar = z.object({
  name: z.string(),
  value: z.string().optional(),
  valueFrom: z.object({
    secretKeyRef: z.object({
      name: z.string(),
      key: z.string(),
    }).optional(),
    configMapKeyRef: z.object({
      name: z.string(),
      key: z.string(),
    }).optional(),
  }).optional(),
})
export type EnvVar = z.infer<typeof EnvVar>

/**
 * Container resource limits and requests
 */
export const ContainerResources = z.object({
  requests: ResourceQuantities.optional(),
  limits: ResourceQuantities.optional(),
})
export type ContainerResources = z.infer<typeof ContainerResources>

/**
 * Full container DTO - the standardized representation of a container
 */
export const Container = z.object({
  // Identity
  name: z.string(),

  // Image configuration
  image: z.string(),
  tag: z.string().optional(),

  // Status
  status: ContainerStatus,
  state: ContainerState.optional().describe('Docker-compatible detailed state'),
  createdAt: z.date(),

  // Networking
  ports: z.array(ContainerPort),
  routes: z.array(z.string()),

  // Terminal
  terminal: z.boolean(),

  // Resources
  cpu: z.string(),
  memory: z.string(),
  storage: z.string(),
  resources: ContainerResources.optional(),

  // Configuration
  restartPolicy: z.enum(['no', 'on-failure', 'always', 'unless-stopped']).default('no'),
  command: Command.optional(),
  args: z.array(z.string()).optional(),
  workingDir: z.string(),
  environment: z.record(z.string(), z.string()),
  volumeMounts: z.array(z.object({
    name: z.string(),
    mountPath: z.string(),
    readOnly: z.boolean().optional(),
  })).optional(),

  // Labels and annotations
  labels: z.record(z.string(), z.string()).optional(),
  annotations: z.record(z.string(), z.string()).optional(),
})
export type Container = z.infer<typeof Container>

/**
 * Container summary - lightweight version for list views
 */
export const ContainerSummary = z.object({
  name: z.string(),
  image: z.string(),
  status: ContainerStatus,
  createdAt: z.date(),
  cpu: z.string(),
  memory: z.string(),
})
export type ContainerSummary = z.infer<typeof ContainerSummary>

/**
 * Container creation input
 */
export const CreateContainerInput = z.object({
  name: z.string().regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/).min(1).max(63),
  image: z.string(),
  ports: z.array(ContainerPort).optional(),
  cpu: z.string().optional().default('250m'),
  memory: z.string().optional().default('512Mi'),
  storage: z.string().optional().default('1Gi'),
  replicas: z.object({
    min: z.number().min(0).optional().default(1),
    max: z.number().min(1).optional().default(1),
  }).optional(),
  environment: z.record(z.string(), z.string()).optional(),
  command: Command.optional(),
  args: z.array(z.string()).optional(),
  workingDir: z.string().optional(),
  cluster: z.enum(['eu-1']).optional(),
})
export type CreateContainerInput = z.infer<typeof CreateContainerInput>
