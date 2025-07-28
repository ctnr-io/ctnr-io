import { z } from "zod";
import { ServerContext } from "ctx/mod.ts";
import { ContainerName, PortName } from "./_common.ts";
import { ensureUserRoute } from "lib/kube-client.ts";
import { hash } from "node:crypto";
import * as shortUUID from "@opensrc/short-uuid";
import { resolveTxt } from "node:dns/promises";

export const Meta = {
  aliases: {
    options: {
      port: "p",
    },
  },
};

export const Input = z.object({
  name: ContainerName,
  domain: z.string().regex(/^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,})+$/).optional().describe(
    "Parent domain name for the routing",
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
      ...routedPorts.map((port) => [
        `${port.name}-${input.name}-${userIdShort}.ctnr.io`,
        input.domain! && `${port.name}.${input.domain}`,
      ]),
    ].flat().filter(Boolean);

    // TODO: ctnr domain add
    // Check for domain ownership, do this before adding HTTPRoute preventing user domain squatting
    if (input.domain) {
      const domain = input.domain.split(".").slice(-2).join(".");
      // Check that the user owns the domain
      const txtRecordName = `ctnr-io-ownership-${userIdShort}.${domain}`;
      const txtRecordValue = hash("sha256", ctx.auth.user.created_at + domain);
      console.log("txtRecordName", txtRecordName);
      const values = await resolveTxt(txtRecordName).catch(() => []);
      console.log("TXT record values:", values);
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
            const values = await resolveTxt(txtRecordName).catch(() => []);
            if (values.flat().includes(txtRecordValue)) {
              clearInterval(interval);
              stderrWriter.write(`TXT record verified successfully.\n`);
              resolve();
            }
          }, 5000);
        });
      }
    }

    await ensureUserRoute(ctx.kube.client, ctx.kube.namespace, {
      hostnames,
      name: input.name,
      userId: ctx.auth.user.id,
      ports: routedPorts,
    });

    stderrWriter.write(
      `Routes created successfully for container ${input.name}:\n` +
        hostnames.map((hostname) => `- https://${hostname}`).join("\r\n") +
        "\r\n",
    );

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
