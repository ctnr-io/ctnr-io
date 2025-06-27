# CTNR CLI

The official command-line interface for CTNR - a modern container platform for running and managing containers in the cloud.

## Installation

### Quick Install (Recommended)

Install the `ctnr` CLI using our installation script:

```bash
curl -fsSL https://get.ctnr.io | bash
```

### Alternative Installation Methods

#### Download from GitHub Releases

Download the latest release for your platform from the [releases page](https://github.com/ctnr-io/ctnr/releases).

**Linux/macOS:**
```bash
# Download and extract (replace with your platform)
tar -xzf ctnr-v1.0.0-linux-x64.tar.gz

# Move to PATH
sudo mv ctnr-linux-x64 /usr/local/bin/ctnr
chmod +x /usr/local/bin/ctnr
```

**Windows:**
```powershell
# Download and extract the zip file
# Move ctnr-windows-x64.exe to a directory in your PATH
```

#### Manual Installation Script

You can also download and run the install script manually:

```bash
curl -fsSL https://raw.githubusercontent.com/ctnr-io/ctnr/main/cli/install.sh | bash
```

## Verify Installation

After installation, verify that the CLI is working:

```bash
ctnr --version
ctnr --help
```

## Configuration

The CLI automatically creates a configuration file at `~/.ctnr/config` with default settings:

```
CTNR_API_URL=https://api.ctnr.io
CTNR_DEFAULT_CONTEXT=production
```

You can modify these settings by editing the config file or using environment variables.

## Usage

### Basic Commands

```bash
# Get help
ctnr --help

# Run a container
ctnr run <image>

# List containers
ctnr list

# Attach to a container
ctnr attach <container-id>

# Get container logs
ctnr logs <container-id>
```

### Authentication

```bash
# Login to CTNR
ctnr auth login

# Check authentication status
ctnr auth status

# Logout
ctnr auth logout
```

### Container Management

```bash
# Run a container with custom options
ctnr run nginx --port 80:8080 --env NODE_ENV=production

# List all containers
ctnr list --all

# Stop a container
ctnr stop <container-id>

# Remove a container
ctnr rm <container-id>
```

## Environment Variables

The CLI respects the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `CTNR_API_URL` | CTNR API endpoint | `https://api.ctnr.io` |
| `CTNR_DEFAULT_CONTEXT` | Default context | `production` |
| `CTNR_CONFIG_DIR` | Configuration directory | `~/.ctnr` |
| `CTNR_TOKEN` | Authentication token | |

## Development

This CLI is built with Deno and TypeScript. The source code is located in the `driver/trpc/remote-cli/` directory.

### Building from Source

```bash
# Clone the repository
git clone https://github.com/ctnr-io/ctnr.git
cd api

# Install Deno (if not already installed)
curl -fsSL https://deno.land/install.sh | sh

# Run the CLI directly
deno run -A driver/trpc/remote-cli/main.ts --help

# Compile to binary
deno compile --allow-all --output ctnr driver/trpc/remote-cli/main.ts
```

## Support

- **Documentation**: [docs.ctnr.io](https://docs.ctnr.io)
- **Issues**: [GitHub Issues](https://github.com/ctnr-io/ctnr/issues)
- **Community**: [Discord](https://discord.gg/ctnr)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
