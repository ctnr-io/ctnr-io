#!/bin/bash
set -e

# CTNR CLI Installer
# Usage: curl -fsSL https://get.ctnr.io | bash

INSTALL_DIR="$HOME/.local/bin"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Detect OS and architecture
detect_platform() {
    local os arch

    case "$(uname -s)" in
        Linux*)     os="linux" ;;
        Darwin*)    os="darwin" ;;
        CYGWIN*|MINGW*|MSYS*) os="windows" ;;
        *)          error "Unsupported operating system: $(uname -s)" ;;
    esac

    case "$(uname -m)" in
        x86_64|amd64)   arch="x64" ;;
        aarch64|arm64)  arch="arm64" ;;
        *)              error "Unsupported architecture: $(uname -m)" ;;
    esac

    echo "${os}-${arch}"
}

# Get latest release version
get_latest_version() {
    curl -s "https://api.github.com/repos/ctnr-io/ctnr-io/releases/latest" | \
        grep '"tag_name":' | \
        sed -E 's/.*"([^"]+)".*/\1/'
}

# Download and install
install_cli() {
    local platform version download_url filename

    platform=$(detect_platform)
    version=$(get_latest_version)

    if [ -z "$version" ]; then
        error "Failed to get latest version"
    fi

    log "Installing ctnr ${version} for ${platform}..."

    if [[ "$platform" == *"windows"* ]]; then
        filename="ctnr-cli-${version}-${platform}.zip"
    else
        filename="ctnr-cli-${version}-${platform}.tar.gz"
    fi

    download_url="https://github.com/ctnr-io/ctnr-io/releases/download/${version}/${filename}"

    # Create temporary directory
    tmp_dir=$(mktemp -d)
    cd "$tmp_dir"

    log "Downloading from ${download_url}..."
    curl -fsSL "$download_url" -o "$filename"

    # Extract
    if [[ "$filename" == *.zip ]]; then
        unzip -q "$filename"
    else
        tar -xzf "$filename"
    fi

    # Find the binary
    binary_name="ctnr-cli-${platform//windows/windows-x64}"
    if [[ "$platform" == *"windows"* ]]; then
        binary_name="${binary_name}.exe"
    fi

    if [ ! -f "$binary_name" ]; then
        error "Binary not found: $binary_name"
    fi

    # Install
    mkdir -p "$INSTALL_DIR"
    mv "$binary_name" "${INSTALL_DIR}/ctnr"

    chmod +x "${INSTALL_DIR}/ctnr"

    # Cleanup
    cd /
    rm -rf "$tmp_dir"

    log "✅ ctnr installed successfully!"

    log "Make sure ${INSTALL_DIR} is in your PATH."
    
    log "You can add it to your shell profile with:"
    log 'export PATH="$HOME/.local/bin:$PATH"'

    log "Run 'ctnr --help' to get started."
    
    rm -f "$HOME/.ctnr/config"  # Remove old config if exists
}

# Check if running as root (not recommended)
if [ "$EUID" -eq 0 ]; then
    warn "Running as root is not recommended"
fi

# Check dependencies
for cmd in curl tar; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        error "$cmd is required but not installed"
    fi
done

# Install
install_cli
