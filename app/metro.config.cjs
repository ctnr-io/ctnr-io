const denoConfig = require('./deno.json')
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const config = getDefaultConfig(__dirname)

config.watchFolders = Object.values(denoConfig.imports).filter((folder) => folder.startsWith('../')).map((folder) =>
  path.resolve(__dirname, folder)
)
// Pre-compute import mappings for faster lookup
const importMappings = Object.entries(denoConfig.imports).sort((a, b) => b[0].length - a[0].length)

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Fast path: check if module starts with known import prefixes
  for (const [importKey, importPath] of importMappings) {
    if (moduleName.startsWith(importKey)) {
      const resolvedPath = moduleName.replace(importKey, importPath)
      const fullPath = path.resolve(__dirname, resolvedPath)
      return context.resolveRequest(context, fullPath, platform);
    }
  }
  
  // Fallback to default resolver
  return context.resolveRequest(context, moduleName, platform);
}

// Add the app's node_modules to the resolver's node_modules paths
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  ...config.resolver.nodeModulesPaths || []
]

module.exports = config
