import type { LabelSelector, ObjectMeta } from './common.ts'

/**
 * HorizontalPodAutoscaler v2
 */
export interface HorizontalPodAutoscaler {
  apiVersion: 'autoscaling/v2'
  kind: 'HorizontalPodAutoscaler'
  metadata: ObjectMeta
  spec: {
    scaleTargetRef: {
      apiVersion: string
      kind: string
      name: string
    }
    minReplicas: number
    maxReplicas: number
    metrics?: HPAMetric[]
    behavior?: HPABehavior
  }
  status?: {
    observedGeneration?: number
    lastScaleTime?: string
    currentReplicas: number
    desiredReplicas: number
    currentMetrics?: Array<{
      type: string
      resource?: {
        name: string
        current: {
          averageUtilization?: number
          averageValue?: string
          value?: string
        }
      }
    }>
    conditions?: Array<{
      type: string
      status: string
      lastTransitionTime?: string
      reason?: string
      message?: string
    }>
  }
}

export interface HPAMetric {
  type: 'Resource' | 'Pods' | 'Object' | 'External' | 'ContainerResource'
  resource?: {
    name: string
    target: HPAMetricTarget
  }
  pods?: {
    metric: {
      name: string
      selector?: LabelSelector
    }
    target: HPAMetricTarget
  }
  object?: {
    describedObject: {
      apiVersion: string
      kind: string
      name: string
    }
    metric: {
      name: string
      selector?: LabelSelector
    }
    target: HPAMetricTarget
  }
  external?: {
    metric: {
      name: string
      selector?: LabelSelector
    }
    target: HPAMetricTarget
  }
  containerResource?: {
    container: string
    name: string
    target: HPAMetricTarget
  }
}

export interface HPAMetricTarget {
  type: 'Utilization' | 'Value' | 'AverageValue'
  averageUtilization?: number
  averageValue?: string
  value?: string
}

export interface HPABehavior {
  scaleDown?: HPAScalingRules
  scaleUp?: HPAScalingRules
}

export interface HPAScalingRules {
  stabilizationWindowSeconds?: number
  selectPolicy?: 'Max' | 'Min' | 'Disabled'
  policies?: Array<{
    type: 'Pods' | 'Percent'
    value: number
    periodSeconds: number
  }>
}
