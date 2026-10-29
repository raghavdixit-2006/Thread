// core/dns.js - Node's c-ares resolver can be pinned to a dead loopback address by
// stale proxy/VPN settings, so mongodb+srv SRV lookups fail even though Windows
// resolves them. Probe the configured resolver and swap to a known-good one only
// when it is loopback-only and actually refusing queries.
import dns from 'node:dns';
import { env } from './env.js';
import { logger } from './logger.js';

const LOOPBACK = new Set(['127.0.0.1', '::1']);

const probe = () =>
  Promise.race([
    dns.promises.resolve4('example.com'),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('dns probe timeout')), 1_500).unref();
    }),
  ]);

export async function ensureDns() {
  const current = dns.getServers();
  if (current.length === 0 || !current.every((server) => LOOPBACK.has(server))) return;

  try {
    await probe(); // a local resolver (proxy/VPN) is alive - respect it
    return;
  } catch {
    dns.setServers(env.DNS_SERVERS);
    logger.warn(
      { from: current, to: env.DNS_SERVERS },
      'loopback DNS resolver is unreachable - Node resolver switched to DNS_SERVERS',
    );
  }
}
