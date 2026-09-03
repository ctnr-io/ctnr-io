#!/bin/sh
set -e
cat > /workspace/dist/env.js <<EOF
globalThis.__CTNR_ENV__ = {
  CTNR_API_URL: "${CTNR_API_URL:-}",
};
EOF
exec /workspace/.bun/bin/bun x serve dist -l 8080 --config /workspace/serve.json
