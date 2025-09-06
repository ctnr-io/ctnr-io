import QontoApi, { CreateClientRequest, CreateClientResponse } from './client.ts'

export class QontoClient extends QontoApi {
  updateClient(pathParams: {id:string}, data: CreateClientRequest, queryParams?: Record<string, any>): Promise<CreateClientResponse> {
    const path = '/v2/clients/:id'.replace(':id', pathParams.id)
    return this.request<CreateClientResponse>('patch', path, data, queryParams)
	}
}

export function getQontoClient() {
	return new QontoClient({
		baseUrl: Deno.env.get('QONTO_API_URL')!,
		login: Deno.env.get('QONTO_API_LOGIN')!,
		secretKey: Deno.env.get('QONTO_API_SECRET_KEY')!,
		stagingToken: Deno.env.get('QONTO_API_STAGING_TOKEN'),
	})
}