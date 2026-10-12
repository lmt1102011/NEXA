#!/usr/bin/env bash
#
# Installs and configures a coturn TURN server on a fresh Ubuntu/Debian (or
# RHEL-family) VM — tuned for Oracle Cloud "Always Free" instances, whose
# public address is NAT'd and whose default firewall drops everything.
#
# Usage (run as root, e.g. `sudo -i` then):
#   PUBLIC_IP=1.2.3.4 PASS='a-long-secret' bash setup-coturn.sh
#
# Env knobs (all optional except PUBLIC_IP, which is auto-detected if omitted):
#   PUBLIC_IP   public IPv4 of the VM
#   PRIVATE_IP  private IPv4 of the VM (auto-detected)
#   REALM       TURN realm (default: nexa)
#   USER_NAME   TURN username (default: nexa)
#   PASS        TURN password (default: random)
#   RELAY_MIN / RELAY_MAX   relay port range (default 49152-65535)
#
# After it finishes it prints the exact block to paste into
# src/services/realtime/turnCredentials.ts.

set -euo pipefail

REALM="${REALM:-nexa}"
USER_NAME="${USER_NAME:-nexa}"
PASS="${PASS:-$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)}"
RELAY_MIN="${RELAY_MIN:-49152}"
RELAY_MAX="${RELAY_MAX:-65535}"
TURN_PORT=3478

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root (sudo -i)." >&2
  exit 1
fi

PRIVATE_IP="${PRIVATE_IP:-$(hostname -I 2>/dev/null | awk '{print $1}')}"
PUBLIC_IP="${PUBLIC_IP:-$(curl -s --max-time 8 https://api.ipify.org || true)}"
if [ -z "${PUBLIC_IP}" ]; then
  echo "Could not determine the public IP. Pass it explicitly: PUBLIC_IP=1.2.3.4 bash $0" >&2
  exit 1
fi

echo ">> public IP:  ${PUBLIC_IP}"
echo ">> private IP: ${PRIVATE_IP}"

# --- install -----------------------------------------------------------------
if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y coturn curl
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y coturn curl
else
  echo "Unsupported package manager (need apt-get or dnf)." >&2
  exit 1
fi

# --- configure ---------------------------------------------------------------
cat >/etc/turnserver.conf <<EOF
# Managed by setup-coturn.sh
listening-port=${TURN_PORT}
listening-ip=${PRIVATE_IP}
external-ip=${PUBLIC_IP}/${PRIVATE_IP}
fingerprint
lt-cred-mech
user=${USER_NAME}:${PASS}
realm=${REALM}
min-port=${RELAY_MIN}
max-port=${RELAY_MAX}
no-multicast-peers
no-loopback-peers
no-cli
no-tls
no-dtls
# Abuse ceilings: keep a runaway client from saturating the VM.
total-quota=100
user-quota=12
bps-capacity=0
stale-nonce=600
simple-log
log-file=/var/log/turnserver.log
EOF

# Debian/Ubuntu ship coturn disabled behind this flag.
if [ -f /etc/default/coturn ]; then
  sed -i 's/^#*TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn
  grep -q '^TURNSERVER_ENABLED=1' /etc/default/coturn || echo 'TURNSERVER_ENABLED=1' >>/etc/default/coturn
fi

# --- firewall ----------------------------------------------------------------
open_port() {
  local proto="$1" port="$2"
  if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
    firewall-cmd --permanent --add-port="${port}/${proto}" >/dev/null
    return
  fi
  iptables -C INPUT -p "${proto}" --dport "${port}" -j ACCEPT 2>/dev/null ||
    iptables -I INPUT 1 -p "${proto}" --dport "${port}" -j ACCEPT
}

open_port udp "${TURN_PORT}"
open_port tcp "${TURN_PORT}"
open_port udp "${RELAY_MIN}:${RELAY_MAX}"

if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --reload >/dev/null
else
  if command -v netfilter-persistent >/dev/null 2>&1; then
    netfilter-persistent save >/dev/null 2>&1 || true
  elif [ -d /etc/iptables ]; then
    iptables-save >/etc/iptables/rules.v4
  fi
fi

# --- start -------------------------------------------------------------------
systemctl enable coturn >/dev/null 2>&1 || true
systemctl restart coturn
sleep 2
systemctl --no-pager --full status coturn | head -n 6 || true

cat <<EOF

==================================================================
coturn is up. Two last things OUTSIDE the VM, in the Oracle console:

  1. Networking -> Virtual Cloud Networks -> your VCN -> Security Lists ->
     Default Security List -> Add Ingress Rules (source 0.0.0.0/0):
        UDP  ${TURN_PORT}
        TCP  ${TURN_PORT}
        UDP  ${RELAY_MIN}-${RELAY_MAX}

  2. Paste this into src/services/realtime/turnCredentials.ts:

export const SELF_HOSTED_TURN: TurnServerConfig = {
  urls: [
    'turn:${PUBLIC_IP}:${TURN_PORT}?transport=udp',
    'turn:${PUBLIC_IP}:${TURN_PORT}?transport=tcp',
  ],
  username: '${USER_NAME}',
  credential: '${PASS}',
}

  Username: ${USER_NAME}
  Password: ${PASS}
==================================================================
EOF
