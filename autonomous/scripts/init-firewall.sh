#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Network Firewall — allowlist outbound traffic via iptables + ipset
# =============================================================================
# Must run as root (sudo) with CAP_NET_ADMIN.
# Resolves allowed domains once at init time.
# =============================================================================

echo "Initialising outbound firewall..."

# ---------------------------------------------------------------------------
# Create ipset for allowed IPs
# ---------------------------------------------------------------------------
ipset create allowed_hosts hash:ip hashsize 4096 timeout 0 2>/dev/null || ipset flush allowed_hosts

# ---------------------------------------------------------------------------
# Allowed domains — resolve to IPs
# ---------------------------------------------------------------------------
# Clerk instance domain — derived from publishable key; override via env var
CLERK_INSTANCE_DOMAIN="${CLERK_INSTANCE_DOMAIN:-promoted-tiger-9.clerk.accounts.dev}"

ALLOWED_DOMAINS=(
    github.com
    api.github.com
    uploads.github.com
    registry.npmjs.org
    api.anthropic.com
    statsig.anthropic.com
    cdn.clerk.io
    us.posthog.com
    clerk.accounts.dev
    "${CLERK_INSTANCE_DOMAIN}"
    api.clerk.dev
    clerk.dev
)

for domain in "${ALLOWED_DOMAINS[@]}"; do
    while IFS= read -r ip; do
        [[ -n "${ip}" ]] && ipset add allowed_hosts "${ip}" 2>/dev/null || true
    done < <(dig +short "${domain}" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$')
done

# ---------------------------------------------------------------------------
# GitHub CIDR ranges — fallback for CDN IP rotation
# ---------------------------------------------------------------------------
echo "Fetching GitHub CIDR ranges..."
GH_META=$(curl -fsSL https://api.github.com/meta 2>/dev/null || echo '{}')

for key in web api git; do
    while IFS= read -r cidr; do
        [[ -n "${cidr}" ]] && ipset add allowed_hosts "${cidr}" 2>/dev/null || true
    done < <(echo "${GH_META}" | jq -r ".${key}[]? // empty" 2>/dev/null)
done

# ---------------------------------------------------------------------------
# iptables rules
# ---------------------------------------------------------------------------

# Allow loopback
iptables -A OUTPUT -o lo -j ACCEPT

# Allow established/related connections
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow Docker embedded DNS (127.0.0.11:53)
iptables -A OUTPUT -d 127.0.0.11 -p udp --dport 53 -j ACCEPT
iptables -A OUTPUT -d 127.0.0.11 -p tcp --dport 53 -j ACCEPT

# Allow internal Docker network (RFC1918 ranges cover compose networks)
iptables -A OUTPUT -d 10.0.0.0/8 -j ACCEPT
iptables -A OUTPUT -d 172.16.0.0/12 -j ACCEPT
iptables -A OUTPUT -d 192.168.0.0/16 -j ACCEPT

# Allow IPs in the ipset
iptables -A OUTPUT -m set --match-set allowed_hosts dst -j ACCEPT

# Deny everything else
iptables -A OUTPUT -j REJECT --reject-with icmp-port-unreachable

echo "Firewall initialised. Allowed $(ipset list allowed_hosts | grep -c 'timeout') hosts."
