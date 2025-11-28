import { z } from 'zod'
import { ResourceQuantities } from '../common.ts'

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
 * Container replica configuration and status
 */
export const ContainerReplicas = z.object({
  min: z.number().min(0),
  max: z.number().min(1),
  current: z.number().min(0),
  instances: z.array(ContainerInstance),
})
export type ContainerReplicas = z.infer<typeof ContainerReplicas>

/**
 * Container status enum matching deployment states
 */
export const ContainerStatus = z.enum([
  'running',
  'stopped',
  'pending',
  'error',
  'unknown',
  'starting',
  'stopping',
])
export type ContainerStatus = z.infer<typeof ContainerStatus>

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
 * Volume mount configuration
 */
export const VolumeMount = z.object({
  name: z.string(),
  mountPath: z.string(),
  readOnly: z.boolean().optional(),
})
export type VolumeMount = z.infer<typeof VolumeMount>

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
  createdAt: z.date(),
  
  // Networking
  ports: z.array(ContainerPort),
  routes: z.array(z.string()),
  
  // Resources
  cpu: z.string(),
  memory: z.string(),
  storage: z.string(),
  resources: ContainerResources.optional(),
  
  // Scaling
  replicas: ContainerReplicas,
  
  // Configuration
  restartPolicy: z.enum(['Always', 'OnFailure', 'Never']).default('Always'),
  command: z.array(z.string()),
  args: z.array(z.string()).optional(),
  workingDir: z.string(),
  environment: z.record(z.string(), z.string()),
  volumeMounts: z.array(VolumeMount).optional(),
  
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
  replicas: z.object({
    current: z.number(),
    desired: z.number(),
  }),
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
  command: z.array(z.string()).optional(),
  args: z.array(z.string()).optional(),
  workingDir: z.string().optional(),
  cluster: z.enum(['eu-0', 'eu-1', 'eu-2']).optional(),
})
export type CreateContainerInput = z.infer<typeof CreateContainerInput>
