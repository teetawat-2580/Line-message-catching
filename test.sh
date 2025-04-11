#!/bin/bash
# Set these values first!
CHANNEL_SECRET="8b642f891d975349dab781d3e0eb2f6e"
ADMIN_ID="Uf09b889b07647fd0b5758cf3a36bce26"
URL="https://excelqueryappjs.onrender.com/webhook"

TEST_BODY='{"events":[{"type":"message","message":{"type":"text","text":"urgent test"},"source":{"userId":"'$ADMIN_ID'","type":"user"}}]}'
SIG=$(echo -n "$TEST_BODY" | openssl dgst -hmac "$CHANNEL_SECRET" -sha256 -binary | base64)

echo "Testing webhook..."
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-line-signature: $SIG" \
  -d "$TEST_BODY" \
  $URL