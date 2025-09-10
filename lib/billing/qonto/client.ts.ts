import collection from './schema.postman.json' with { type: 'json' }

const ApiReference = collection as any

// Simple type generation from JSON objects
function generateType(obj: any, depth = 0): string {
  if (obj === null || obj === undefined) return 'any'
  if (typeof obj !== 'object') return typeof obj
  if (Array.isArray(obj)) {
    return obj.length > 0 ? `${generateType(obj[0], depth + 1)}[]` : 'any[]'
  }

  if (depth > 3) return 'any' // Prevent deep nesting

  const props = Object.entries(obj)
    .map(([key, value]) => `  ${key}: ${generateType(value, depth + 1)};`)
    .join('\n')

  return `Partial<{\n${props}\n}>`
}

// Extract endpoints from Postman collection
function extractEndpoints(): Array<{
  name: string
  method: string
  path: string
  requestType: string
  responseType: string
  pathParams: string[]
}> {
  const endpoints: any[] = []

  function processItem(item: any) {
    if (item.item) {
      item.item.forEach(processItem)
    } else if (item.request) {
      const method = item.request.method?.toLowerCase() || 'get'
      const url = typeof item.request.url === 'string' ? item.request.url : item.request.url?.raw || ''

      // Handle template variables and extract the path
      let cleanUrl = url
      if (typeof item.request.url === 'object' && item.request.url.raw) {
        cleanUrl = item.request.url.raw
      }

      // Skip OAuth URLs that don't have /v2/ paths
      if (cleanUrl.includes('oauth2') || cleanUrl.includes('/v3/')) {
        return
      }

      // Extract the path part, handling template variables
      let path = ''
      if (cleanUrl.includes('/v2/')) {
        // Extract everything from /v2/ onwards, removing query parameters
        const v2Match = cleanUrl.match(/\/v2\/[^?]*/)
        if (v2Match) {
          path = v2Match[0]
        } else {
          return
        }
      } else {
        return
      }

      // Extract unique path parameters
      const pathParamMatches = path.match(/:([a-zA-Z_]\w*)/g) || []
      const pathParams = [...new Set(pathParamMatches.map((p: string) => p.slice(1)))]

      // Get response type from first successful response
      let responseType = 'any'
      if (item.response?.[0]?.body) {
        try {
          const parsed = JSON.parse(item.response[0].body)
          responseType = generateType(parsed)
        } catch {
          responseType = 'any'
        }
      }

      // Get request type from request body
      let requestType = 'void'
      if (item.request.body?.raw) {
        try {
          const parsed = JSON.parse(item.request.body.raw)
          requestType = generateType(parsed)
        } catch {
          requestType = 'any'
        }
      }

      // Convert name to camelCase and remove articles
      let name = item.name || 'unknown'
      name = name
        .replace(/\b(a|an|the)\b/gi, '') // Remove articles
        .replace(/[^a-zA-Z0-9\s]/g, ' ') // Replace special chars with spaces
        .trim()
        .split(/\s+/)
        .map((word: string, index: number) => {
          if (index === 0) return word.toLowerCase()
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        })
        .join('')

      endpoints.push({ name, method, path, requestType, responseType, pathParams })
    }
  }

  ApiReference?.item?.forEach(processItem)
  return endpoints
}

const endpoints = extractEndpoints()

export default `
// Qonto API TypeScript SDK - Auto-generated from Postman Collection

// Base types
export interface QontoError {
  code: string;
  detail: string;
  source?: { parameter?: string; pointer?: string; };
}

export interface QontoErrorResponse {
  errors: QontoError[];
}

// Generated endpoint types
${
  endpoints.map((ep) => {
    const Name = ep.name.charAt(0).toUpperCase() + ep.name.slice(1)
    const pathParamsType = ep.pathParams.length > 0
      ? `export interface ${Name}PathParams {\n${ep.pathParams.map((p) => `  ${p}: string;`).join('\n')}\n}\n\n`
      : ''
    const requestType = ep.requestType !== 'void' ? `export type ${Name}Request = ${ep.requestType};\n\n` : ''
    const responseType = `export type ${Name}Response = ${ep.responseType};\n\n`

    return pathParamsType + requestType + responseType
  }).join('')
}

// API Client
export class QontoApi {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: { baseUrl: string; login: string; secretKey: string; stagingToken?: string; }) {
    this.baseUrl = config.baseUrl || 'https://thirdparty.qonto.com';
    this.headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': config.login + ':' + config.secretKey
    };
    if (config.stagingToken) {
      this.headers['X-Qonto-Staging-Token'] = config.stagingToken;
    }
  }

  protected async request<T>(method: string, path: string, data?: any, params?: Record<string, any>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value != null) url.searchParams.set(key, String(value));
      });
    }

    const response = await fetch(url.toString(), {
      method: method.toUpperCase(),
      headers: this.headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error('Qonto API Error: ' + response.status + ' - ' + JSON.stringify(error));
    }

    return response.json();
  }

${
  endpoints.map((ep) => {
    const Name = ep.name.charAt(0).toUpperCase() + ep.name.slice(1)
    const hasPathParams = ep.pathParams.length > 0
    const hasRequestBody = ep.requestType !== 'void'

    const params = []
    if (hasPathParams) params.push(`pathParams: ${Name}PathParams`)
    if (hasRequestBody) params.push(`data: ${Name}Request`)
    params.push(`queryParams?: Record<string, any>`)

    const pathReplacement = hasPathParams ? ep.pathParams.map((p) => `.replace(':${p}', pathParams.${p})`).join('') : ''

    const dataArg = hasRequestBody ? ', data' : ', undefined'

    return `  ${ep.name}(${params.join(', ')}): Promise<${Name}Response> {
    const path = '${ep.path}'${pathReplacement};
    return this.request<${Name}Response>('${ep.method}', path${dataArg}, queryParams);
  }`
  }).join('\n\n')
}
}

export default QontoApi;
`
