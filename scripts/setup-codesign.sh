#!/bin/bash
# Setup self-signed Code Signing certificate for Prompt Line development.
# This certificate allows macOS TCC to recognize the app across rebuilds,
# preventing accessibility permission resets on every update.
#
# Usage: pnpm run setup-codesign
set -euo pipefail

CERT_NAME="Prompt Line"
KEYCHAIN="${HOME}/Library/Keychains/login.keychain-db"

# Check if certificate already exists
if security find-identity -v -p codesigning 2>/dev/null | grep -q "\"${CERT_NAME}\""; then
  echo "✅ Certificate '${CERT_NAME}' already exists. Skipping."
  exit 0
fi

echo "Creating self-signed Code Signing certificate '${CERT_NAME}'..."

# Create temporary directory for certificate files
TMPDIR_CERT=$(mktemp -d)
trap "rm -rf ${TMPDIR_CERT}" EXIT

# Generate certificate config with Code Signing extended key usage
cat > "${TMPDIR_CERT}/cert.conf" <<EOF
[ req ]
distinguished_name = req_dn
prompt = no
[ req_dn ]
CN = ${CERT_NAME}
[ extensions ]
keyUsage = digitalSignature
extendedKeyUsage = codeSigning
basicConstraints = CA:false
EOF

# Generate self-signed certificate (valid for 10 years)
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "${TMPDIR_CERT}/key.pem" \
  -out "${TMPDIR_CERT}/cert.pem" \
  -days 3650 \
  -config "${TMPDIR_CERT}/cert.conf" \
  -extensions extensions \
  2>/dev/null

# Convert to PKCS#12 format for Keychain import
openssl pkcs12 -export \
  -inkey "${TMPDIR_CERT}/key.pem" \
  -in "${TMPDIR_CERT}/cert.pem" \
  -out "${TMPDIR_CERT}/cert.p12" \
  -passout pass: \
  -name "${CERT_NAME}" \
  2>/dev/null

# Import into login keychain
security import "${TMPDIR_CERT}/cert.p12" \
  -k "${KEYCHAIN}" \
  -T /usr/bin/codesign \
  -f pkcs12 \
  -P ""

# Trust the certificate for code signing (may prompt for password)
echo "Setting certificate as trusted for code signing (you may be prompted for your login password)..."
security add-trusted-cert -p codeSign -k "${KEYCHAIN}" "${TMPDIR_CERT}/cert.pem"

# Verify the certificate is available
if security find-identity -v -p codesigning 2>/dev/null | grep -q "\"${CERT_NAME}\""; then
  echo "✅ Certificate '${CERT_NAME}' created and imported successfully."
  echo ""
  echo "Next steps:"
  echo "  1. Run 'pnpm run build' to build with the new certificate"
  echo "  2. Grant Accessibility permission once in System Settings"
  echo "  3. Future rebuilds will maintain the permission automatically"
else
  echo "❌ Certificate creation failed. Please try creating it manually via Keychain Access."
  echo "   Open Keychain Access > Certificate Assistant > Create a Certificate"
  echo "   Name: ${CERT_NAME}, Type: Code Signing"
  exit 1
fi
