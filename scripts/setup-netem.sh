#!/usr/bin/env bash
set -euo pipefail
IFACE=${1:-eth0}
DELAY=${2:-40ms}
JITTER=${3:-10ms}
LOSS=${4:-0%}

sudo tc qdisc del dev "$IFACE" root 2>/dev/null || true
sudo tc qdisc add dev "$IFACE" root netem delay "$DELAY" "$JITTER" loss "$LOSS"
tc qdisc show dev "$IFACE"
