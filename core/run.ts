import { yaml } from "@tmpl/core";
import { z } from "zod";
import { kubectlApply } from "@ctnr/api/util/kubectl-apply.ts";

export const input = z.tuple([
  z.string().describe("Name of the Knative Service"),
  z.object({
    image: z.string().describe("Container image to run"),
    env: z.record(z.string()).optional().describe("Environment variables"),
    ports: z.array(z.number()).optional().describe("Ports to expose"),
    resources: z.object({
      limits: z.record(z.string()).optional(),
      requests: z.record(z.string()).optional(),
    }).optional().describe("Resource requirements"),
    scale: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
      target: z.number().optional(),
    }).optional().describe("Scaling configuration"),
  }),
]);

export type Input = z.infer<typeof input>;

export default (context: any) => (input: Input) => {
  const [name, { image, env, ports, resources, scale }] = input;

  const service = yaml`
    apiVersion: knative.dev/v1
    kind: Service
    metadata:
      name: ${name}
      namespace: default
    spec:
      template:
        spec:
          containers:
            - image: ${image}
              env:
                ${Object.entries(env || {}).map(([key, value]) => yaml`${key}: ${value}`)}
              ports:
                ${ports?.map((port) => yaml`- containerPort: ${port}`)}
              resources:
                limits:
                  ${Object.entries(resources?.limits || {}).map(([key, value]) => yaml`${key}: ${value}`)}
                requests:
                  ${Object.entries(resources?.requests || {}).map(([key, value]) => yaml`${key}: ${value}`)}
          scaling:
            minReplicas: ${scale?.min || 1}
            maxReplicas: ${scale?.max || 10}
            targetCPUUtilizationPercentage: ${scale?.target || 80}
            targetMemoryUtilizationPercentage: ${scale?.target || 80}
  `.noindent();

  return kubectlApply(service);
};
