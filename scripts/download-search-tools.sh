#!/bin/bash
# Download fd and ripgrep binaries for bundling with the application.
# These tools are used for file search (@) and symbol search (@lang:) features.
#
# Usage: bash scripts/download-search-tools.sh
set -euo pipefail

FD_VERSION="10.4.2"
RG_VERSION="15.1.0"
OUTPUT_DIR="src/native-tools"

# Detect architecture
ARCH=$(uname -m)
case "${ARCH}" in
  arm64)  ARCH_SUFFIX="aarch64-apple-darwin" ;;
  x86_64) ARCH_SUFFIX="x86_64-apple-darwin" ;;
  *)
    echo "⚠️ Unsupported architecture: ${ARCH}. Skipping search tools download."
    exit 0
    ;;
esac

mkdir -p "${OUTPUT_DIR}"
TMPDIR_DL=$(mktemp -d)
trap "rm -rf ${TMPDIR_DL}" EXIT

# Download and extract fd
if [ -f "${OUTPUT_DIR}/fd" ] && "${OUTPUT_DIR}/fd" --version 2>/dev/null | grep -q "${FD_VERSION}"; then
  echo "✅ fd v${FD_VERSION} already exists. Skipping."
else
  FD_URL="https://github.com/sharkdp/fd/releases/download/v${FD_VERSION}/fd-v${FD_VERSION}-${ARCH_SUFFIX}.tar.gz"
  echo "Downloading fd v${FD_VERSION} (${ARCH})..."
  curl -sL "${FD_URL}" -o "${TMPDIR_DL}/fd.tar.gz"
  tar -xzf "${TMPDIR_DL}/fd.tar.gz" -C "${TMPDIR_DL}"
  cp "${TMPDIR_DL}/fd-v${FD_VERSION}-${ARCH_SUFFIX}/fd" "${OUTPUT_DIR}/fd"
  chmod +x "${OUTPUT_DIR}/fd"
  echo "✅ fd v${FD_VERSION} downloaded."
fi

# Download and extract ripgrep
if [ -f "${OUTPUT_DIR}/rg" ] && "${OUTPUT_DIR}/rg" --version 2>/dev/null | grep -q "${RG_VERSION}"; then
  echo "✅ ripgrep v${RG_VERSION} already exists. Skipping."
else
  RG_URL="https://github.com/BurntSushi/ripgrep/releases/download/${RG_VERSION}/ripgrep-${RG_VERSION}-${ARCH_SUFFIX}.tar.gz"
  echo "Downloading ripgrep v${RG_VERSION} (${ARCH})..."
  curl -sL "${RG_URL}" -o "${TMPDIR_DL}/rg.tar.gz"
  tar -xzf "${TMPDIR_DL}/rg.tar.gz" -C "${TMPDIR_DL}"
  cp "${TMPDIR_DL}/ripgrep-${RG_VERSION}-${ARCH_SUFFIX}/rg" "${OUTPUT_DIR}/rg"
  chmod +x "${OUTPUT_DIR}/rg"
  echo "✅ ripgrep v${RG_VERSION} downloaded."
fi
