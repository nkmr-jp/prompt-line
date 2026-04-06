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
cat > "${TMPDIR_CERT}/prompt-line-cert.conf" <<EOF
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
  -keyout "${TMPDIR_CERT}/prompt-line-cert.pem" \
  -out "${TMPDIR_CERT}/prompt-line-cert.crt" \
  -days 3650 \
  -config "${TMPDIR_CERT}/prompt-line-cert.conf" \
  -extensions extensions \
  2>/dev/null

# Convert to PKCS#12 format for Keychain import
# Use old-format encryption (PBE-SHA1-3DES) for macOS Keychain compatibility with OpenSSL 3.x
openssl pkcs12 -export \
  -certpbe PBE-SHA1-3DES \
  -keypbe PBE-SHA1-3DES \
  -macalg sha1 \
  -inkey "${TMPDIR_CERT}/prompt-line-cert.pem" \
  -in "${TMPDIR_CERT}/prompt-line-cert.crt" \
  -out "${TMPDIR_CERT}/prompt-line-cert.p12" \
  -passout pass:prompt-line \
  -name "${CERT_NAME}" \
  2>/dev/null

# Import into login keychain
security import "${TMPDIR_CERT}/prompt-line-cert.p12" \
  -k "${KEYCHAIN}" \
  -T /usr/bin/codesign \
  -f pkcs12 \
  -P "prompt-line"

# Rename the private key's ACL description from "cert" to "Prompt Line"
# so macOS Keychain access dialogs show a recognizable name.
# (PKCS#12 import sets ACL description to "cert" by default)
echo "Setting private key name in Keychain..."
swift - "${CERT_NAME}" <<'SWIFT'
import Foundation
import Security

let newName = CommandLine.arguments[1]

// Find the most recently imported RSA private key
let query: [String: Any] = [
    kSecClass as String: kSecClassKey,
    kSecAttrKeyType as String: kSecAttrKeyTypeRSA,
    kSecAttrKeyClass as String: kSecAttrKeyClassPrivate,
    kSecAttrKeySizeInBits as String: 2048,
    kSecReturnRef as String: true,
    kSecMatchLimit as String: kSecMatchLimitAll
]

var result: AnyObject?
guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
      let keys = result as? [SecKey] else { exit(0) }

// Find the key whose ACL description is "cert" (last one = most recently imported)
for key in keys.reversed() {
    var access: SecAccess?
    guard SecKeychainItemCopyAccess(key as! SecKeychainItem, &access) == errSecSuccess,
          let acc = access else { continue }

    var aclList: CFArray?
    SecAccessCopyACLList(acc, &aclList)
    guard let acls = aclList as? [SecACL] else { continue }

    var found = false
    for acl in acls {
        var appList: CFArray?
        var desc: CFString?
        var prompt = SecKeychainPromptSelector()
        SecACLCopyContents(acl, &appList, &desc, &prompt)
        if (desc as String?) == "cert" { found = true; break }
    }
    guard found else { continue }

    // Update all ACL entries for this key
    for acl in acls {
        var appList: CFArray?
        var desc: CFString?
        var prompt = SecKeychainPromptSelector()
        SecACLCopyContents(acl, &appList, &desc, &prompt)
        guard let currentDesc = desc as String?, currentDesc == "cert" else { continue }
        SecACLSetContents(acl, appList, newName as CFString, prompt)
    }
    SecKeychainItemSetAccess(key as! SecKeychainItem, acc)
    print("✅ Key ACL description set to '\(newName)'")
    break
}
SWIFT

# Trust the certificate for code signing (may prompt for login password)
echo "Setting certificate as trusted for code signing (you may be prompted for your login password)..."
security add-trusted-cert -p codeSign -k "${KEYCHAIN}" "${TMPDIR_CERT}/prompt-line-cert.crt"

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
