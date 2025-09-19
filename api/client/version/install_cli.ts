import { ClientRequest, ClientResponse } from 'lib/api/types.ts'
import z from 'zod'
import { match } from 'ts-pattern'
import * as GetServerVersion from 'api/server/version/get_version.ts'
import { VersionContext } from 'ctx/mod.ts'

export const Meta = {} as const

export const Input = z.object({ force: z.boolean().optional() })

export type Input = z.infer<typeof Input>

export type Output = void

// TODO: finish and test it
export default async function* installCli(request: ClientRequest<Input, VersionContext>): ClientResponse {
  yield `🔍 Checking for the latest CLI version...`

  // Fetch latest release info from GitHub API
  // Call server to know its current version
  const url = new URL(GetServerVersion.Meta.openapi.path, Deno.env.get('CTNR_API_URL')!)
  const response = await fetch(url, {
    method: GetServerVersion.Meta.openapi.method,
  })
  if (!response.ok) {
    throw new Error('Failed to fetch server version')
  }
  const serverVersion: GetServerVersion.Output = await response.json()
  const cliVersion = request.ctx.version

  // If cli version != remote version, re-install cli
  if (!request.input.force && serverVersion === cliVersion) {
    yield `✅ You are already using the latest version (${cliVersion}).`
    return
  }

  const releaseResponse = await fetch(
    'https://api.github.com/repos/ctnr-io/ctnr-io/releases/' +
      (serverVersion === 'latest' ? 'latest' : `tags/${serverVersion}`),
  )
  if (!releaseResponse.ok) {
    throw new Error('Failed to fetch latest release info')
  }
  const release: { tag_name: string; assets: { name: string; browser_download_url: string }[] } = await releaseResponse
    .json()

  const version = release.tag_name

  const arch = match(Deno.build.arch)
    .with('x86_64', () => 'x64')
    .with('aarch64', () => 'arm64')
    .otherwise(() => Deno.build.arch)
  if (!['x64', 'arm64'].includes(arch)) {
    throw new Error(`Unsupported architecture: ${arch}`)
  }

  const os = Deno.build.os
  if (!['linux', 'darwin', 'windows'].includes(os)) {
    throw new Error(`Unsupported OS: ${os}`)
  }

  const extension = os === 'windows' ? 'zip' : 'tar.gz'

  // Find the appropriate asset for the current OS and architecture
  const asset = release.assets.find((asset: { name: string }) =>
    ['cli', version, os, arch, extension].every((v) => asset.name.includes(v))
  )
  if (!asset) {
    throw new Error('No suitable asset found for download')
  }

  yield `⬇️  Downloading CLI version ${version} for ${os} ${arch}...`
  const binaryResponse = await fetch(asset.browser_download_url)
  if (!binaryResponse.ok) {
    throw new Error('Failed to download the CLI binary')
  }

  // Save the binary to a temporary file
  const tempFilePath = Deno.makeTempFileSync({
    prefix: 'ctnr-cli-',
  })
  const file = await Deno.open(tempFilePath, { write: true })
  await binaryResponse.body?.pipeTo(file.writable)

  // Create the temporary extraction directory
  await Deno.mkdir(`${tempFilePath}-dir`)

  // Uncompress the binary
  const uncompressCommand = new Deno.Command(
    Deno.build.os === 'windows' ? 'powershell' : 'tar',
    {
      args: Deno.build.os === 'windows'
        ? ['-Command', `Expand-Archive -Path ${tempFilePath} -DestinationPath ${tempFilePath}-dir`]
        : ['-xzf', tempFilePath, '-C', `${tempFilePath}-dir`],
      stdout: 'piped',
      stderr: 'piped',
    },
  )
  const uncompressProcess = uncompressCommand.spawn()
  const { code } = await uncompressProcess.status
  if (code !== 0) {
    const errorString = await new Response(uncompressProcess.stderr).text()
    throw new Error(`Failed to uncompress the CLI binary\r\n${errorString}`)
  }

  // Create installation directory if it doesn't exist
  const installDir = Deno.build.os === 'windows'
    ? Deno.env.get('USERPROFILE') + '\\.local\\bin'
    : Deno.env.get('HOME') + '/.local/bin'
  await Deno.mkdir(installDir, { recursive: true })

  // Move the binary to the installation directory
  const sourcePath = Deno.build.os === 'windows'
    ? `${tempFilePath}-dir\\ctnr-cli-${os}-${arch}.exe`
    : `${tempFilePath}-dir/ctnr-cli-${os}-${arch}`
  const destPath = Deno.build.os === 'windows' ? `${installDir}\\ctnr.exe` : `${installDir}/ctnr`
  await Deno.rename(sourcePath, destPath)

  // Make it executable (non-Windows only)
  if (Deno.build.os !== 'windows') {
    await Deno.chmod(destPath, 0o755)
  }
  // Clean up
  await Deno.remove(tempFilePath)

  yield `✅ CLI updated to version ${version} and installed at ${destPath}`

  // Add installDir to PATH if not already present
  if (!Deno.env.get('PATH')?.split(Deno.build.os === 'windows' ? ';' : ':').includes(installDir)) {
    yield `⚠️  Make sure ${installDir} is in your PATH environment variable.`
    if (Deno.build.os === 'windows') {
      yield `You can add it to PATH by running: setx PATH "%PATH%;${installDir}"`
    } else {
      yield `You can add it to PATH by running: echo 'export PATH="$PATH:${installDir}"' >> ~/.bashrc && source ~/.bashrc`
    }
  }
}
