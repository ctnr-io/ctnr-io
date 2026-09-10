if (Deno.args[0] === 'mcp') {
  await import('api/drivers/trpc/client/mcp/main.ts')
} else {
  await import('api/drivers/trpc/client/terminal/main.ts')
}
