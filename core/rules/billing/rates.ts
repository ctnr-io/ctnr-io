/**
 * Default pricing rates (€0.01 = 1 credit)
 * 
 * Based on Contabo VPS 20 infrastructure costs:
 * - CPU: €0.84/core/mo base + 20% K8s overhead = €1.00/core/mo actual
 * - Memory: €0.42/GB/mo base + 20% K8s overhead = €0.50/GB/mo actual
 * - Storage: €0.04/GB/mo × 3 (Rook-Ceph replication) + 25% overhead = €0.15/GB/mo actual
 * 
 * Rates set at ~2.5x margin for sustainable operations
 */
export const DEFAULT_RATES = {
  cpuPerHour: 0.35, // 0.35 credits/core/hr → €2.52/core/mo (2.5x margin)
  memoryPerHour: 0.15, // 0.15 credits/GB/hr → €1.08/GB/mo (2.2x margin)
  storagePerHour: 0.05, // 0.05 credits/GB/hr → €0.36/GB/mo (2.4x margin, 3x Ceph replication)
}
