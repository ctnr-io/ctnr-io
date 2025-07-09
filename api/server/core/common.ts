import { z } from "zod";

export const gatewayListeners = [
	'http',
	'https',
	'tls',
	'grpc',
] as const

const PortNumber = z.number()
			// TODO: Add port restrictions when stricter security is needed
			// .min(1024, "Only unprivileged ports (>= 1024) are allowed for security")
			.max(65535, "Port number must be valid")
		
const PortName = z.string().regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, "Port name must be valid DNS-1123 label")
	.describe("Name of the port to expose");

export const Port = z.string().refine((value) => {
	const [portName, portNumber = portName] = value.split(":");
	if (portName === portNumber) {
		// If no name is provided, treat it as a number
		return PortNumber.safeParse(Number(portName)).success;
	} else {
		// If a name is provided, validate both name and number
		return PortName.safeParse(portName).success && PortNumber.safeParse(Number(portNumber)).success;
	}
}).transform(value => {
	const [portName, portNumber = portName] = value.split(":");
	if (portName === portNumber) {
		// If no name is provided, treat it as a number
		return { name: String(portNumber), containerPort: Number(portNumber) };
	} else {
		// If a name is provided, return both name and number
		return { name: portName, containerPort: Number(portNumber) };
	}
}).describe("<name>:<number> or <number>");


export const Expose = z.string().refine((value) => {
  const [gtwListener, port = gtwListener] = value.split(":");
  if (gtwListener === port) {
    // If no listener is provided, treat it as a port
    return PortNumber.safeParse(Number(gtwListener)).success;
  } else {
    // If a listener is provided, validate both listener and port
    return gatewayListeners.includes(gtwListener as typeof gatewayListeners[number]) &&
      PortNumber.safeParse(Number(port)).success;
  }
}).transform(value => {
  const [gtwListener, port = gtwListener] = value.split(":");
  if (gtwListener === port) {
    // If no listener is provided, treat it as a port
    return { name: "https", port: Number(port) };
  } else {
    // If a listener is provided, return both listener and port
    return { name: gtwListener, port: Number(port) };
  }
}).describe(`<${gatewayListeners.join('|')}>:<port> or <port>, default to https if no listener is provided`);