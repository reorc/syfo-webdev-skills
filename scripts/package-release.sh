#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="${1:-${ROOT}/dist}"
VERSION="${SYFO_WEBDEV_SKILLS_VERSION:-$(git -C "${ROOT}" describe --tags --exact-match 2>/dev/null || git -C "${ROOT}" rev-parse --verify --short HEAD 2>/dev/null || printf 'unreleased')}"
COMMIT="$(git -C "${ROOT}" rev-parse --verify HEAD 2>/dev/null || printf 'uncommitted')"
ARCHIVE="syfo-webdev-skills.tar.gz"

rm -rf "${DIST}"
mkdir -p "${DIST}"

COPYFILE_DISABLE=1 tar \
  -czf "${DIST}/${ARCHIVE}" \
  -C "${ROOT}" \
  syfo-webdev \
  syfo-webdev-static \
  syfo-webdev-fullstack

cat > "${DIST}/manifest.json" <<EOF
{
  "schemaVersion": 1,
  "version": "${VERSION}",
  "commit": "${COMMIT}",
  "archive": "${ARCHIVE}",
  "managedMarker": {
    "name": ".syfo-managed.json",
    "managedBy": "syfo-daemon",
    "schemaVersion": 1
  },
  "skills": [
    "syfo-webdev",
    "syfo-webdev-static",
    "syfo-webdev-fullstack"
  ]
}
EOF

(
  cd "${DIST}"
  sha256sum "${ARCHIVE}" manifest.json > checksums.txt
)

echo "packaged ${VERSION} in ${DIST}"
