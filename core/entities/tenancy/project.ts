/**
 * Project DTOs
 * Standardized data structures for project resources
 */
import { z } from 'zod'
import { ClusterName } from '../common.ts'

/**
 * Full Project DTO
 */
export const ProjectSchema = z.object({
  id: z.string().describe('Project unique identifier'),
  name: z.string().describe('Project name'),
  ownerId: z.string().describe('Owner user ID'),
  cluster: ClusterName.describe('Cluster where the project is hosted'),
  namespace: z.string().describe('Kubernetes namespace name'),
  createdAt: z.string().optional().describe('Creation timestamp'),
  balance: z.object({
    credits: z.number().describe('Available credits'),
    currency: z.string().optional().describe('Currency code'),
  }).optional().describe('Project balance'),
})

export type Project = z.infer<typeof ProjectSchema>

/**
 * Project Summary DTO (lightweight)
 */
export const ProjectSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  cluster: ClusterName,
	namespace: z.string(),
})

export type ProjectSummary = z.infer<typeof ProjectSummarySchema>

/**
 * Create Project Input
 */
export const CreateProjectInputSchema = z.object({
  name: z.string().min(1).max(63).describe('Project name'),
})

export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>
