import { z } from "zod";
import { ServerContext } from "ctx/mod.ts";
import { ContainerName, PortName } from "./_common.ts";
import { ensureCertManagerCertificate, ensureHttpRoute, ensureService } from "lib/kube-client.ts";
import { hash } from "node:crypto";
import * as shortUUID from "@opensrc/short-uuid";

export const Meta = {
  aliases: {
    options: {
      port: "p",
    },
  },
};

export const Input = z.object({
  name: ContainerName,
  fqdn: z.string().regex(/^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,})+$/).optional().describe(
    "Fully qualified domain name for the route, defaults to '<port>-<name>-<user>.ctnr.io'",
  ),
  port: z.array(PortName).optional().describe(
    "Ports to expose, defaults to all ports of the container",
  ),
});

export type Input = z.infer<typeof Input>;

const shortUUIDtranslator = shortUUID.createTranslator(shortUUID.constants.uuid25Base36);

export default async ({ ctx, input }: { ctx: ServerContext; input: Input }) => {
  const stderrWriter = ctx.stdio.stderr.getWriter();
  try {
    // Get all ports of the container
    const pod = await ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).getPod(input.name).catch(() => {
      throw new Error(`Container ${input.name} not found`);
    });

    const containerPorts = pod.spec?.containers?.[0]?.ports || [];
    if (containerPorts.length === 0) {
      throw new Error(`Container ${input.name} has no ports exposed`);
    }

    // If no ports is not specified, use all ports, if ports length === 0, remove all ports 
    const routedPorts = (
      input.port === undefined
        ? containerPorts
        : input.port.length === 0
        ? []
        : containerPorts.filter((p) =>
          input.port!.includes(p.name ?? "") || input.port!.includes(p.containerPort.toString())
        )
    )
      .map((port) => ({
        name: port.name || `${port.containerPort}`,
        port: port.containerPort,
      }));

    if (routedPorts.length === 0) {
      throw new Error(`No ports found for container ${input.name} matching specified ports`);
    }

    const userIdShort = shortUUIDtranslator.fromUUID(ctx.auth.user.id);
    const hostnames = [
      ...routedPorts.map((port) => (
        `${port.name}-${input.name}-${userIdShort}.ctnr.io`
      )),
      input.fqdn!,
    ].filter(Boolean);

    await ensureService(ctx.kube.client, ctx.kube.namespace, {
      metadata: {
        name: input.name,
        namespace: ctx.kube.namespace,
      },
      spec: {
        ports: routedPorts,
        selector: {
          "ctnr.io/owner-id": ctx.auth.user.id,
          "ctnr.io/name": input.name,
        },
      },
    });
    await ensureHttpRoute(ctx.kube.client, ctx.kube.namespace, {
      apiVersion: "gateway.networking.k8s.io/v1",
      kind: "HTTPRoute",
      metadata: {
        name: input.name,
        namespace: ctx.kube.namespace,
      },
      spec: {
        hostnames,
        parentRefs: [
          {
            name: "public-gateway",
            namespace: "kube-public",
            sectionName: "https",
          },
          {
            name: "public-gateway",
            namespace: "kube-public",
            sectionName: "http",
          },
        ],
        rules: [{
          matches: [{ path: { type: "PathPrefix", value: "/" } }],
          backendRefs: routedPorts.map((port) => ({
            kind: "Service",
            name: input.name,
            port: port.port,
          })),
        }],
      },
    });
    stderrWriter.write(
      `Routes created successfully for container ${input.name}:\n` +
        hostnames.map((hostname) => `- https://${hostname}`).join("\r\n") +
        "\r\n",
    );
    // TODO: ctnr domain add
    if (input.fqdn) {
      const domain = input.fqdn.split(".").slice(-2).join(".");
      // Check that the user owns the domain
      const txtRecordName = `ctnr-io_ownership_${userIdShort}.${domain}`;
      const txtRecordValue = hash("sha256", ctx.auth.user.created_at + domain);
      const values = await Deno.resolveDns(txtRecordName, "TXT").catch(() => []);
      if (values.flat().includes(txtRecordValue)) {
        stderrWriter.write(`Domain ownership for ${domain} already verified.\n`);
      } else {
        // Check if the TXT record already exists
        stderrWriter.write(
          [
            "",
            `Verifying domain ownership for ${domain}...`,
            "",
            `Please create a TXT record with the following details:`,
            `Name: ${txtRecordName}`,
            `Value: ${txtRecordValue}`,
            "",
            "",
          ].join("\r\n"),
        );
        // Wait for the user to create the TXT record
        await new Promise<void>((resolve, reject) => {
          const interval = setInterval(async () => {
            if (ctx.signal?.aborted) {
              clearInterval(interval);
              reject();
              return;
            }
            stderrWriter.write(`Checking for TXT record...\n`);
            const values = await Deno.resolveDns(txtRecordName, "TXT").catch(() => []);
            if (values.flat().includes(txtRecordValue)) {
              clearInterval(interval);
              stderrWriter.write(`TXT record verified successfully.\n`);
              resolve();
            }
          }, 5000);
        });
      }

      // Generate certificate for the domain if it doesn't exist
      await ensureCertManagerCertificate(ctx.kube.client, ctx.kube.namespace, {
        apiVersion: "cert-manager.io/v1",
        kind: "Certificate",
        metadata: {
          name: input.name,
          namespace: ctx.kube.namespace,
        },
        spec: {
          secretName: `${input.name}-tls`,
          issuerRef: {
            name: "letsencrypt",
            kind: "ClusterIssuer",
          },
          commonName: input.fqdn,
          dnsNames: hostnames,
        },
      });
      stderrWriter.write(
        [
          `Certificate created successfully for domain ${input.fqdn}]\r\n`,
          "Points your DNS to gateway.ctnr.io with a CNAME record.\r\n",
        ].join(""),
      );
    }

    stderrWriter.releaseLock();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error from server";
    console.error("Route creation failed:", errorMessage);

    const stderrWriter = ctx.stdio.stderr.getWriter();
    stderrWriter.write(`Error creating route: ${errorMessage}\n`);
    stderrWriter.releaseLock();

    throw error;
  }
};
