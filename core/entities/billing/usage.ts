/**
 * Usage DTO
 * Represents resource usage and billing information for a project
 */
import { z } from 'zod'

/**
 * Balance schema
 */
export const BalanceSchema = z.object({
  credits: z.number(),
  lastUpdated: z.string(),
})
export type Balance = z.infer<typeof BalanceSchema>

/**
 * Balance status
 */
export const BalanceStatusSchema = z.enum([
  'normal',
  'resource_limits_reached_for_current_usage',
  'resource_limits_reached_for_additional_resource',
  'insufficient_credits_for_current_usage',
  'insufficient_credits_for_additional_resource',
  'free_tier',
])
export type BalanceStatus = z.infer<typeof BalanceStatusSchema>

/**
 * Resource usage metrics
 */
export const ResourceMetricSchema = z.object({
  used: z.string(),
  limit: z.string(),
  next: z.string(),
  percentage: z.number(),
})
export type ResourceMetric = z.infer<typeof ResourceMetricSchema>

/**
 * Resource usage
 */
export const ResourceUsageSchema = z.object({
  cpu: ResourceMetricSchema,
  memory: ResourceMetricSchema,
  storage: ResourceMetricSchema,
})
export type ResourceUsage = z.infer<typeof ResourceUsageSchema>

/**
 * Cost breakdown
 */
export const CostBreakdownSchema = z.object({
  hourly: z.number(),
  daily: z.number(),
  monthly: z.number(),
})
export type CostBreakdown = z.infer<typeof CostBreakdownSchema>

/**
 * Costs
 */
export const CostsSchema = z.object({
  current: CostBreakdownSchema,
  next: CostBreakdownSchema,
  max: CostBreakdownSchema,
})
export type Costs = z.infer<typeof CostsSchema>

/**
 * Tier
 */
export const TierSchema = z.enum(['free', 'paid'])
export type Tier = z.infer<typeof TierSchema>

/**
 * Full Usage schema
 */
export const UsageSchema = z.object({
  balance: BalanceSchema,
  resources: ResourceUsageSchema,
  costs: CostsSchema,
  status: BalanceStatusSchema,
  tier: TierSchema,
})
export type Usage = z.infer<typeof UsageSchema>

/**
 * Usage summary (same as full for now)
 */
export const UsageSummarySchema = UsageSchema
export type UsageSummary = Usage
