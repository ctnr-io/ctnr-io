import type { ContainerRuntime } from 'core/schemas/compute/container.ts'
import { parseCpuToMillicores } from 'core/transform/resources.ts'

/**
 * runtimeClassName applied when the 'kata' runtime is selected.
 * Matches the RuntimeClass installed on nested-virt-capable nodes (mk8s.eu KubeVirt VMs).
 */
export const KATA_RUNTIME_CLASS = 'kata-qemu'

/**
 * Kata boots a real VM per pod and cannot be scheduled below one full CPU.
 */
export const KATA_MIN_CPU_MILLICORES = 1000

/**
 * Resolve the Kubernetes runtimeClassName for a runtime selection.
 * containerd (the default) uses the node default, so it has no runtimeClass.
 */
export function runtimeClassNameFor(runtime: ContainerRuntime): string | undefined {
  return runtime === 'kata' ? KATA_RUNTIME_CLASS : undefined
}

/**
 * Enforce the kata >= 1 CPU rule. Throws a user-facing error when kata is chosen
 * with less than one CPU rather than silently bumping the request (which would
 * change what the tenant is billed for).
 */
export function assertKataCpuMinimum(runtime: ContainerRuntime, cpu: string): void {
  if (runtime !== 'kata') return
  const millicores = parseCpuToMillicores(cpu)
  if (millicores < KATA_MIN_CPU_MILLICORES) {
    throw new Error(
      `The 'kata' runtime requires at least 1 CPU (got '${cpu}'). ` +
        `Set --cpu 1 or higher, or use --runtime containerd.`,
    )
  }
}
