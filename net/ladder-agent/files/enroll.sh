#!/bin/sh
# Exchange a one-time Panel enroll_token for a long-lived control token (uplink).
# Reads/writes UCI section ladder-agent.main.
set -e

. /lib/functions.sh

config_load "ladder-agent"

PANEL_URL=
NODE_ID=
TOKEN=
ENROLL_TOKEN=

config_get PANEL_URL "main" "panel_url" ""
config_get NODE_ID "main" "node_id" ""
config_get TOKEN "main" "token" ""
config_get ENROLL_TOKEN "main" "enroll_token" ""

if [ -n "$TOKEN" ]; then
	echo "ladder-agent enroll: token already set, skipping"
	exit 0
fi

[ -n "$PANEL_URL" ] || {
	echo "ladder-agent enroll: panel_url required" >&2
	exit 1
}
[ -n "$NODE_ID" ] || {
	echo "ladder-agent enroll: node_id required" >&2
	exit 1
}
[ -n "$ENROLL_TOKEN" ] || {
	echo "ladder-agent enroll: enroll_token required when token is empty" >&2
	exit 1
}

TMPDIR="${TMPDIR:-/tmp}"
REQ="$TMPDIR/ladder-agent-enroll-req.$$"
RESP="$TMPDIR/ladder-agent-enroll-resp.$$"
trap 'rm -f "$REQ" "$RESP"' EXIT

printf '{"node_id":"%s"}' "$NODE_ID" >"$REQ"

PANEL_BASE="${PANEL_URL%/}"
URL="$PANEL_BASE/api/v1/agent/enroll"

echo "ladder-agent enroll: POST $URL node_id=$NODE_ID"

HTTP_CODE="$(curl -sS --max-time 30 --retry 2 \
	-o "$RESP" -w '%{http_code}' \
	-X POST "$URL" \
	-H "Authorization: Bearer $ENROLL_TOKEN" \
	-H "Content-Type: application/json" \
	--data-binary @"$REQ")" || {
	echo "ladder-agent enroll: request failed" >&2
	exit 1
}

if [ "$HTTP_CODE" != "200" ]; then
	echo "ladder-agent enroll: HTTP $HTTP_CODE: $(head -c 500 "$RESP" 2>/dev/null)" >&2
	exit 1
fi

CONTROL_TOKEN="$(jsonfilter -i "$RESP" -e '@.control_token' 2>/dev/null || true)"
[ -n "$CONTROL_TOKEN" ] || {
	echo "ladder-agent enroll: response missing control_token" >&2
	exit 1
}

uci -q set ladder-agent.main.token="$CONTROL_TOKEN"
uci -q delete ladder-agent.main.enroll_token
uci -q commit ladder-agent

echo "ladder-agent enroll: control token saved; enroll_token cleared"
exit 0
