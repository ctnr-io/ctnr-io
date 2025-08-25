const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const config = getDefaultConfig(__dirname);

const rootDir = path.resolve(__dirname, "../");

config.watchFolders = [
  rootDir,
];

const importMappings = fs
  .readdirSync(rootDir, { withFileTypes: true })
  .filter((value) => value.isDirectory())
  .map((value) => [value.name, path.resolve(rootDir, value.name)]);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Fast path: check if module starts with known import prefixes
  for (const [importKey, importPath] of importMappings) {
    if (moduleName.startsWith(importKey)) {
      const resolvedPath = moduleName.replace(importKey, importPath);
      const fullPath = path.resolve(__dirname, resolvedPath);
      return context.resolveRequest(context, fullPath, platform);
    }
  }

  // Fallback to default resolver
  return context.resolveRequest(context, moduleName, platform);
};

// Add the app's node_modules to the resolver's node_modules paths
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  ...config.resolver.nodeModulesPaths || [],
];

module.exports = config;
