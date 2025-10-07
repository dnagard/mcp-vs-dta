#!/usr/bin/env bash
set -euo pipefail
IFACE=${1:-eth0}
DELAY=${2:-40ms}
JITTER=${3:-10ms}
LOSS=${4:-0%}
CORR=${5:-}      # e.g. "25%" for bursty loss correlation
RATE=${6:-}      # e.g. "10mbit" for slowlink rate limit

sudo tc qdisc del dev "$IFACE" root 2>/dev/null || true

# Build netem args
ARGS=( netem delay "$DELAY" "$JITTER" loss "$LOSS" )
# Append correlation to loss if provided
if [[ -n "${CORR}" ]]; then
  ARGS+=( "$CORR" )
fi
# Append rate if provided (modern netem supports "rate", else you can swap to TBF)
if [[ -n "${RATE}" ]]; then
  ARGS+=( rate "$RATE" )
fi

sudo tc qdisc add dev "$IFACE" root "${ARGS[@]}"
tc qdisc show dev "$IFACE"
