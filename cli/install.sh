#!/bin/bash
set -e

# CTNR CLI Installer
# Usage: curl -fsSL https://get.ctnr.io | bash

CLI_NAME="ctnr"
REPO="ctnr-io/api"
INSTALL_DIR="/usr/local/bin"

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
    curl -s "https://api.github.com/repos/${REPO}/releases/latest" | \
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

    log "Installing ${CLI_NAME} ${version} for ${platform}..."

    if [[ "$platform" == *"windows"* ]]; then
        filename="${CLI_NAME}-${version}-${platform}.zip"
    else
        filename="${CLI_NAME}-${version}-${platform}.tar.gz"
    fi

    download_url="https://github.com/${REPO}/releases/download/${version}/${filename}"

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
    binary_name="${CLI_NAME}-${platform//windows/windows-x64}"
    if [[ "$platform" == *"windows"* ]]; then
        binary_name="${binary_name}.exe"
    fi

    if [ ! -f "$binary_name" ]; then
        error "Binary not found: $binary_name"
    fi

    # Install
    if [ -w "$INSTALL_DIR" ]; then
        mv "$binary_name" "${INSTALL_DIR}/${CLI_NAME}"
    else
        log "Installing to ${INSTALL_DIR} (requires sudo)..."
        sudo mv "$binary_name" "${INSTALL_DIR}/${CLI_NAME}"
    fi

    chmod +x "${INSTALL_DIR}/${CLI_NAME}"

    # Cleanup
    cd /
    rm -rf "$tmp_dir"

    log "✅ ${CLI_NAME} installed successfully!"
    log "Run '${CLI_NAME} --help' to get started."
    
    # Set default environment variables
    log "Setting up default configuration..."
    if [ ! -f "$HOME/.ctnr/config" ]; then
        mkdir -p "$HOME/.ctnr"
        cat > "$HOME/.ctnr/config" << 'CONFIG_EOF'
CTNR_API_URL=https://api.ctnr.io
CTNR_DEFAULT_CONTEXT=production
CONFIG_EOF
        log "Created default config at $HOME/.ctnr/config"
    fi
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
