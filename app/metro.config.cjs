const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')
const fs = require('fs')
const { createProxyMiddleware } = require('http-proxy-middleware')

const process = require('../lib/node/process.ts').default

const config = getDefaultConfig(__dirname)

const rootDir = path.resolve(__dirname, '../')

config.watchFolders = [
  rootDir,
]

const importMappings = fs
  .readdirSync(rootDir, { withFileTypes: true })
  .filter((value) => value.isDirectory())
  .map((value) => [value.name, path.resolve(rootDir, value.name)])

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'node:process') {
    moduleName = 'lib/node/process.ts'
  }

  // Fast path: check if module starts with known import prefixes
  for (const [importKey, importPath] of importMappings) {
    if (moduleName.startsWith(importKey)) {
      const resolvedPath = moduleName.replace(importKey, importPath)
      const fullPath = path.resolve(__dirname, resolvedPath)
      console.debug(`Resolving ${moduleName} to ${fullPath}`)
      return context.resolveRequest(context, fullPath, platform)
    }
  }

  // Fallback to default resolver
  return context.resolveRequest(context, moduleName, platform)
}

// Add the app's node_modules to the resolver's node_modules paths
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  ...config.resolver.nodeModulesPaths || [],
]

/**
 * Rewrite all request url to /api to the api
 * Useful to use the expo ngrok feature to test billing as mollie need to access localhost
 * Look at api handler billing/buy_credits.ts for more information.
 */
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.info(`API request made to: ${req.url}`)
      const proxy = createProxyMiddleware({
        target: process.env.CTNR_API_URL,
        changeOrigin: true,
        pathRewrite: {
          '^/api': '',
        },
      })
      return proxy(req, res, next)
    }
    return middleware(req, res, next)
  }
}

module.exports = config
