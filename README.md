# Metal - High availability on bare ctnr

Metal is a tool for creating and managing Kubernetes clusters on bare ctnr servers, with a focus on high availability, cost-effectiveness and simplicity.

## Overview

Metal provides a streamlined approach to setting up and managing Kubernetes clusters on physical hardware. It handles the initialization, joining, and resetting of nodes, as well as the installation and configuration of essential components like Cilium for fast networking (powered by eBPF) and load balancing.

## Features

- **Node Management**: Initialize control plane nodes, join worker nodes, and reset nodes when needed
- **Networking**: Integrated Cilium support for networking and load balancing
- **Metrics**: Built-in metrics server installation
- **CLI Interface**: Simple command-line interface for cluster management using tRPC
- **IPv4/IPv6 Support**: Dual-stack networking capabilities
- **Cloud-init Integration**: Uses cloud-init for node provisioning and configuration
- **Template Generation**: Automatically generates configuration files from TypeScript templates
- **Ingress Testing**: Built-in tools for testing ingress functionality
- **Secret Encryption**: Automatic encryption of Kubernetes secrets at rest in etcd

## Prerequisites

- Deno runtime
- SSH access to target servers
- Root or sudo access on target servers
- kubectl (for interacting with the cluster)

## Installation

Clone the repository:

```bash
git clone https://github.com/ctnr.io/ctnr.git
cd ctnr
```

## Configuration

Metal can be configured through environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| METAL_SSH_USER | SSH username | root |
| METAL_SSH_HOST | SSH host | localhost |
| METAL_SSH_PRIVATE_KEY | SSH private key path | |
| METAL_API_SERVER_HOST | API server host | 0.0.0.0 |
| METAL_API_SERVER_PORT | API server port | 6443 |
| METAL_POD_CIDR | Pod CIDR | 10.244.0.0/16 |
| METAL_SERVICE_CIDR | Service CIDR | 10.96.0.0/12 |
| METAL_CILIUM_POD_CIDR_V4| Cilium Pod CIDR | 172.16.0.0/15 |
| METAL_CILIUM_POD_CIDR_V6 | Cilium Pod CIDR (IPv6) | fd00:172:16::/111 |
| METAL_CILIUM_NATIVE_ROUTING_CIDR_V4 | Cilium native routing CIDR | 172.16.0.0/12 |
| METAL_CILIUM_NATIVE_ROUTING_CIDR_V6 | Cilium native routing CIDR (IPv6) | fd00:172:16::/104 |
| METAL_CILIUM_LOAD_BALANCER_IPV4_POOL | Cilium load balancer IPv4 pool | 10.16.0.0/15 |
| METAL_CILIUM_LOAD_BALANCER_IPV6_POOL | Cilium load balancer IPv6 pool | fd00:10:16::/111 |
| METAL_INTERNAL_IPV4_CIDR | Node internal IPv4 subnet | |
| METAL_INTERNAL_IPV6_CIDR | Node internal IPv6 subnet | |
| METAL_KUBECONFIG | Kubeconfig output path | kubeconfig.yaml |

## Development Workflow

### Generate Configuration Files

Before using Metal, you need to generate the configuration files from the TypeScript templates:

```bash
make generate
```

Or using Deno tasks:

```bash
deno task gen:core
```

This command processes all template files (with extensions like .yml.ts, .sh.ts, etc.) in the core directory and generates the actual configuration files.

### Available Deno Tasks

Metal provides several Deno tasks defined in deno.json:

```bash
# Run the API server in watch mode
deno task api

# Run the API server
deno task serve

# Run API tests
deno task test:api

# Generate core configuration files
deno task gen:core

# Run the Metal CLI
deno task ctnr
```

## Usage

### Initialize a Control Plane Node

```bash
deno run -A cli/ctnr.ts node init "user@host" --api-server-host=<API_SERVER_IP> --internal-ipv4=<NODE_INTERNAL_IP>
```

Or using Deno tasks:

```bash
deno task ctnr node init "user@host" --api-server-host=<API_SERVER_IP> --internal-ipv4=<NODE_INTERNAL_IP>
```

### Join a Worker Node

```bash
deno run -A cli/ctnr.ts node join "user@host" --api-server-host=<API_SERVER_IP> --internal-ipv4=<NODE_INTERNAL_IP>
```

### Join a Control Plane Node

```bash
deno run -A cli/ctnr.ts node join "user@host" --control-plane --api-server-host=<API_SERVER_IP> --internal-ipv4=<NODE_INTERNAL_IP>
```

### Reset a Node

```bash
deno run -A cli/ctnr.ts node reset "user@host" --api-server-host=<API_SERVER_IP>
```

### SSH to a Node

Metal provides a helper command for SSH access to nodes:

```bash
make ssh host=<hostname>
```

### Run Tests

```bash
make test
```

To run a specific test:

```bash
make test/ingress_test.ts
```

## Project Structure

- `api/`: API interface and tRPC procedures for the CLI and server
- `cli/`: Command-line interface using tRPC-CLI
- `core/`: Core functionality for node management
  - `node/base/`: Base configuration for all nodes
  - `node/init/`: Control plane initialization
  - `node/join/`: Node joining (control plane and worker)
  - `node/reset/`: Node reset functionality
- `lib/`: Utility functions and helpers for SSH, file operations, etc.
- `test/`: Test files and fixtures for functionality testing

## How It Works

Metal uses a combination of TypeScript templates and cloud-init to provision and configure Kubernetes nodes:

1. **Template Generation**: TypeScript template files (.ts) are processed to generate configuration files (YAML, shell scripts, etc.)
2. **SSH Execution**: Metal connects to target servers via SSH to execute commands
3. **Cloud-init Integration**: Cloud-init is used for initial node provisioning and configuration
4. **Kubeadm Orchestration**: Kubeadm is used to initialize the control plane and join worker nodes
5. **Cilium Networking**: Cilium is installed for networking and load balancing
6. **Metrics Server**: A metrics server is installed for resource monitoring
7. **Secret Encryption**: Kubernetes secrets are automatically encrypted at rest in etcd using AES-CBC and Secretbox encryption providers

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Kubernetes](https://kubernetes.io/)
- [Cilium](https://cilium.io/)
- [Deno](https://deno.land/)
- [tRPC](https://trpc.io/)
- [cloud-init](https://cloud-init.io/)
