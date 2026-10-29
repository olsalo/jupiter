import { isIP } from "node:net"

// The ingress must overwrite this header, never append client-supplied values.
export function trustedIpHeader() {
  return process.env.TRUSTED_CLIENT_IP_HEADER?.trim().toLowerCase() || process.env.BOOKING_TRUSTED_IP_HEADER?.trim().toLowerCase() || "x-real-ip"
}

export function trustedClientIp(headers: Headers) {
  const header = trustedIpHeader()
  const value = headers.get(header)?.trim()
  // Reject chains rather than trusting the attacker-controlled first hop.
  return value && isIP(value) ? value : null
}
