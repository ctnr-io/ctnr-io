<div align="center">

# 🌥️ ctnr.io

**A modern, cost-effective container platform for running and managing containers in the cloud.**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Built with Deno](https://img.shields.io/badge/Built%20with-Deno-000000?logo=deno)](https://deno.land)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)

[Documentation](https://docs.ctnr.io) • [Discord](https://discord.gg/9wqquM9hfj) • [Report Bug](https://github.com/ctnr-io/ctnr-io/issues)

</div>

---

## ✨ Features

- 🚀 **Simple & Fast** — Deploy containers in seconds with an intuitive CLI
- 💰 **Cost-Effective** — Optimized for affordable cloud container hosting
- 🌐 **Cross-Platform** — Native apps for Web, iOS, Android, and a powerful CLI
- 🔒 **Secure** — Built-in authentication
- 📊 **Real-time Monitoring** — Live logs, metrics, and container status
- 🔌 **tRPC API** — Type-safe API with full TypeScript support
- ☸️ **Kubernetes Native** — Powered by Kubernetes under the hood

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CTNR Platform                        │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│     CLI     │   Web App   │  iOS App    │   Android App    │
│   (Deno)    │   (Expo)    │   (Expo)    │     (Expo)       │
├─────────────┴─────────────┴─────────────┴──────────────────┤
│                      tRPC API Layer                         │
├─────────────────────────────────────────────────────────────┤
│   Core Schemas   │   Rules Engine   │   Transformers       │
├──────────────────┼──────────────────┼──────────────────────┤
│  • Compute       │  • Billing       │  • Container         │
│  • Network       │  • Tenancy       │  • Project           │
│  • Storage       │                  │  • Route             │
│  • Billing       │                  │  • Volume            │
│  • Tenancy       │                  │                      │
├─────────────────────────────────────────────────────────────┤
│                   Infrastructure Layer                      │
│   Kubernetes  │  Zitadel   │  Mollie  │  DNS Provider      │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Installation

### Quick Install (Recommended)

```bash
curl -fsSL https://get.ctnr.io | bash
```

### Download from Releases

Download the latest release for your platform from [GitHub Releases](https://github.com/ctnr-io/ctnr-io/releases).

<details>
<summary><strong>Linux/macOS</strong></summary>

```bash
# Download and extract (replace with your platform)
tar -xzf ctnr-v1.0.0-linux-x64.tar.gz

# Move to PATH
sudo mv ctnr-linux-x64 /usr/local/bin/ctnr
chmod +x /usr/local/bin/ctnr
```

</details>

<details>
<summary><strong>Windows</strong></summary>

```powershell
# Download and extract the zip file
# Move ctnr-windows-x64.exe to a directory in your PATH
```

</details>

### Verify Installation

```bash
ctnr --version
ctnr --help
```

## 🚀 Quick Start

### 1. Authenticate

```bash
ctnr login
```

### 2. Run Your First Container

```bash
ctnr run nginx
```

### 3. View Your Containers

```bash
ctnr list
```

## 📖 Usage

### Container Management

```bash
# Run a container with custom options
ctnr run nginx --publish www:80 --env NODE_ENV=production --route www

# List all containers
ctnr list --all

# View container logs
ctnr logs <container-name>

# Attach to a container
ctnr attach <container-name>

# Stop a container
ctnr stop <container-name>

# Remove a container
ctnr rm <container-name>
```

### Authentication

```bash
# Login to CTNR
ctnr login

# Logout
ctnr logout
```

## ⚙️ Configuration

The CLI automatically creates a configuration file at `~/.ctnr/config`:

```bash
CTNR_API_URL=https://api.ctnr.io
CTNR_DEFAULT_CONTEXT=production
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CTNR_API_URL` | CTNR API endpoint | `https://api.ctnr.io` |
| `CTNR_DEFAULT_CONTEXT` | Default context | `production` |
| `CTNR_CONFIG_DIR` | Configuration directory | `~/.ctnr` |
| `CTNR_TOKEN` | Authentication token | — |

## 🛠️ Development

### Prerequisites

- [Deno](https://deno.land) v1.40+
- [Bun](https://bun.sh) (for the mobile/web app)
- [Docker](https://docker.com) (optional, for local testing)

### Project Structure

```
ctnr/
├── api/              # API layer (tRPC handlers, drivers)
│   ├── context/      # Request contexts
│   ├── drivers/      # tRPC client/server drivers
│   └── handlers/     # Route handlers
├── app/              # Cross-platform app (Expo + React Native)
├── cli/              # Command-line interface
├── core/             # Business logic
│   ├── data/         # Data access layer
│   ├── rules/        # Business rules engine
│   ├── schemas/      # Zod schemas (compute, network, storage, etc.)
│   └── transform/    # Data transformers
├── infra/            # Infrastructure integrations
│   ├── dns/          # DNS provider
│   ├── kubernetes/   # Kubernetes client
│   ├── mollie/       # Payment processing
│   └── zitadel/      # Authentication (OIDC IdP)
└── lib/              # Shared utilities
```

### Running Locally

```bash
# Clone the repository
git clone https://github.com/ctnr-io/ctnr.git
cd ctnr

# Install Deno (if not already installed)
curl -fsSL https://deno.land/install.sh | sh

# Run the tRPC server
deno task trpc:server:watch

# Run the CLI
deno task ctnr --help

# Run the app (requires Bun)
deno task app:start
```

### Building from Source

```bash
# Compile CLI to binary
deno task compile --output ctnr cli/main.ts
```

## 🧪 Testing

```bash
# Run all tests
deno test -A

# Run specific test file
deno test -A e2e/api/core/
```

### Local CI (act)

Run the PR-blocking GitHub Actions gates locally with [`act`](https://github.com/nektos/act)
before pushing, to save GitHub Actions minutes. This runs only the three jobs that gate a PR
(`test`, `typecheck-app`, `e2e-api-core-compose`) - the build/publish/live-cluster jobs need
registry credentials and a real cluster, so they stay GitHub-only.

Prerequisites: Docker running locally, and `act` (`brew install act`, this was verified against
`0.2.89`). On Apple Silicon, `.actrc` already sets `--container-architecture linux/amd64` since
act's runner images are amd64-only.

```bash
deno task ci:local
```

This is wired from `.actrc` (runner image pin + arch flag) and
`.github/act/pull_request.event.json` (a minimal synthetic `pull_request` event payload, since
act has no real PR to read one from).

**Known caveats, both upstream/environment issues, not bugs in this wiring:**

- Every job using `denoland/setup-deno@v2` ends with `🏁 Job failed` even when every real step
  above it shows `✅ Success` (Main Type check / Lint / Format check, or the actual test run).
  The failure is act's own `Post Setup Deno` cleanup step, which can't find `node` in `$PATH`
  inside the runner container - a known act limitation
  ([nektos/act#107](https://github.com/nektos/act/issues/107)), unresolved as of act `0.2.89`.
  Read the step-level output, not the final job status.
- `typecheck-app`'s `npm install` can fail resolving a `git+ssh://github.com/...` dependency if
  your machine has no working SSH access to GitHub from inside the act container. Not something
  this wiring can fix locally; rely on GitHub CI for that job if it fails for you.

## 🤝 Contributing

We love contributions! Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the **GNU General Public License v3.0** — see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- 📖 **Documentation**: [docs.ctnr.io](https://docs.ctnr.io)
- 🐛 **Issues**: [GitHub Issues](https://github.com/ctnr-io/ctnr-io/issues)
- 💬 **Community**: [Discord](https://discord.gg/9wqquM9hfj)
- 🌐 **Website**: [ctnr.io](https://www.ctnr.io)

---

<div align="center">

**Made with ❤️ by the CTNR team**

</div>
