#!/usr/bin/env bash
set -euo pipefail
IFACE=${1:-eth0}
sudo tc qdisc del dev "$IFACE" root 2>/dev/null || true
tc qdisc show dev "$IFACE"
