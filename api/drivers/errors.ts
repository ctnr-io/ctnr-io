
/**
 * Error thrown when the client version is out of date and needs to be upgraded.
 * Can be catch by the client's driver to auto upgrade
 */
export class ClientVersionError extends Error {
	override message: string = 'Client version is out of date. Please upgrade the client.'
}

/**
 * Error thrown when there is an authentication error on the client side
 * Can be catch by the client's driver to prompt for re-authentication
 */
export class ClientAuthError extends Error {
	override message: string = 'Authentication error. Please login again.'
}