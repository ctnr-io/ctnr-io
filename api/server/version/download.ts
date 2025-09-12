import { WebhookRequest, WebhookResponse } from 'lib/api/types.ts'
import z from 'zod'

export const Meta = {
	openapi: { method: 'GET', path: '/' },
} as const

export const Input = z.object({
})

export type Input = z.infer<typeof Input>

export type Output = Response

// TODO: finish and test it
export default async function* DownloadCli({ ctx, input }: WebhookRequest<Input>): WebhookResponse<Output> {
	// Permit to download the latest cli version on github by forwarding the data from the github artifact link
	const response = await fetch('https://api.github.com/repos/ctnr-io/ctnr-io/releases/latest')
	if (!response.ok) {
		throw new Error('Failed to fetch latest release info')
	}
	const release = await response.json()
	const asset = release.assets.find((a: any) => a.name === 'ctnr-linux-amd64.tar.gz' || a.name === 'ctnr-darwin-amd64.tar.gz' || a.name === 'ctnr-windows-amd64.zip')
	if (!asset) {
		throw new Error('No suitable asset found for download')
	}
	const downloadResponse = await fetch(asset.browser_download_url)
	if (!downloadResponse.ok) {
		throw new Error('Failed to download the CLI binary')
	}
	return downloadResponse
}