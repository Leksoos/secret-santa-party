import os from 'os';
import type { Request, Response } from 'express';

export interface NetworkInterfaceItem {
  name: string;
  address: string;
  family: string;
  score?: number;
  internal?: boolean;
}

export interface NetworkInfoResponse {
  success: boolean;
  ip: string;
  port: number;
  serverPort: number;
  url: string;
  tunnelUrl: string | null;
  isOverridden: boolean;
  interfaces: NetworkInterfaceItem[];
}

export interface NetworkDetectionOptions {
  hostIp?: string;
  tunnelUrl?: string;
  cloudUrl?: string;
  clientPort?: number;
  serverPort?: number;
  networkInterfaces?: NodeJS.Dict<os.NetworkInterfaceInfo[]>;
}

/**
 * Calculates a heuristic priority score for a network interface and IP address.
 *
 * Scoring Heuristics:
 * - Wi-Fi adapters (en0, wlan0, wlo1, wl*, "wi-fi", "wireless"): +100
 * - Secondary macOS adapters (en1-en9): +70
 * - Physical Ethernet adapters (eth*, enp*, ens*, "ethernet"): +60
 * - VPN adapters (utun*, tun*, tap*, tailscale*, wg*, ppp*): -50
 * - Container/virtual adapters (docker*, veth*, br-*, vmnet*, vboxnet*): -80
 *
 * IP Subnet Heuristics:
 * - 192.168.x.x (standard home/venue Wi-Fi router subnet): +50
 * - 10.x.x.x (office / mesh network subnet): +40
 * - 172.16.x.x - 172.31.x.x (RFC 1918 class B): +20
 * - 169.254.x.x (APIPA / link-local unreachable by phones): -100
 */
export function calculateInterfaceScore(ifaceName: string, ip: string): number {
  let score = 0;
  const name = ifaceName.toLowerCase();

  // Name scoring
  if (/^(docker|veth|br-|vmnet|vboxnet)/i.test(name)) {
    score -= 80;
  } else if (/^(utun|tun|tap|tailscale|wg|ppp)/i.test(name)) {
    score -= 50;
  } else if (/^(en0|wlan0|wlo1|wl)/i.test(name) || name.includes('wi-fi') || name.includes('wireless')) {
    score += 100;
  } else if (/^en[1-9]/i.test(name)) {
    score += 70;
  } else if (/^(eth[0-9]|enp|ens)/i.test(name) || name.includes('ethernet')) {
    score += 60;
  }

  // IP subnet scoring
  if (ip.startsWith('192.168.')) {
    score += 50;
  } else if (ip.startsWith('10.')) {
    score += 40;
  } else if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) {
    score += 20;
  } else if (ip.startsWith('169.254.')) {
    score -= 100;
  }

  return score;
}

function parsePort(val: any, fallback: number): number {
  if (typeof val === 'number' && !isNaN(val) && val > 0) return val;
  if (typeof val === 'string') {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

/**
 * Discovers host network information, prioritizing accessible local Wi-Fi IPv4 interfaces,
 * with support for manual overrides via options or environment variables (HOST_IP, TUNNEL_URL).
 */
export function getNetworkInfo(options: NetworkDetectionOptions = {}): NetworkInfoResponse {
  const hostIpOverride =
    options.hostIp !== undefined
      ? options.hostIp.trim() || undefined
      : process.env.HOST_IP?.trim() || undefined;

  const rawTunnelUrl =
    options.tunnelUrl !== undefined
      ? options.tunnelUrl.trim() || undefined
      : process.env.TUNNEL_URL?.trim() || undefined;

  const tunnelUrl = rawTunnelUrl ? rawTunnelUrl.replace(/\/+$/, '') : null;

  const rawCloudUrl =
    options.cloudUrl !== undefined
      ? options.cloudUrl.trim() || undefined
      : (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || process.env.RAILWAY_STATIC_URL || process.env.PUBLIC_URL)?.trim() || undefined;

  const cloudUrl = rawCloudUrl ? rawCloudUrl.replace(/\/+$/, '') : null;

  const serverPort = parsePort(options.serverPort ?? process.env.PORT, 3001);
  const clientPort = parsePort(
    options.clientPort ?? process.env.CLIENT_PORT ?? process.env.VITE_PORT,
    5173
  );

  const ifaces = options.networkInterfaces || os.networkInterfaces();
  const candidates: Array<{ name: string; address: string; family: string; score: number }> = [];

  for (const [name, list] of Object.entries(ifaces)) {
    if (!list) continue;
    for (const item of list) {
      const family = String(item.family);
      // Strictly IPv4
      if (family !== 'IPv4' && family !== '4') continue;
      // Exclude loopback/internal
      if (item.internal) continue;
      // Exclude 127.x.x.x
      if (item.address.startsWith('127.')) continue;

      const score = calculateInterfaceScore(name, item.address);
      candidates.push({
        name,
        address: item.address,
        family: 'IPv4',
        score,
      });
    }
  }

  // Sort candidates by score descending
  candidates.sort((a, b) => b.score - a.score);

  const interfaces: NetworkInterfaceItem[] = candidates.map((c) => ({
    name: c.name,
    address: c.address,
    family: c.family,
    score: c.score,
  }));

  let selectedIp = '127.0.0.1';
  let isOverridden = false;

  if (hostIpOverride) {
    selectedIp = hostIpOverride;
    isOverridden = true;
    if (!interfaces.some((i) => i.address === selectedIp)) {
      interfaces.unshift({ name: 'manual', address: selectedIp, family: 'IPv4', score: 999 });
    }
  } else if (candidates.length > 0) {
    selectedIp = candidates[0].address;
  } else {
    // Fallback to loopback if no external interface found
    interfaces.push({ name: 'lo0', address: '127.0.0.1', family: 'IPv4', score: 0, internal: true });
  }

  if (tunnelUrl || cloudUrl) {
    isOverridden = true;
  }

  const finalUrl = tunnelUrl || cloudUrl || `http://${selectedIp}:${clientPort}`;

  return {
    success: true,
    ip: selectedIp,
    port: clientPort,
    serverPort,
    url: finalUrl,
    tunnelUrl: tunnelUrl || cloudUrl,
    isOverridden,
    interfaces,
  };
}

/**
 * Express route handler for GET /api/network-info
 */
export function networkInfoHandler(req: Request, res: Response): void {
  const queryPort = req.query?.port ? parsePort(req.query.port, 0) : 0;

  // Auto-detect public cloud domain from headers if running on cloud hosting
  const hostHeader = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
  const protoHeader = (req.headers['x-forwarded-proto'] as string) || (req.secure ? 'https' : 'http');
  let detectedCloudUrl: string | undefined = undefined;

  if (
    hostHeader &&
    !hostHeader.startsWith('localhost') &&
    !hostHeader.startsWith('127.') &&
    !hostHeader.startsWith('192.168.') &&
    !hostHeader.startsWith('10.') &&
    !/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostHeader)
  ) {
    detectedCloudUrl = `${protoHeader}://${hostHeader}`;
  }

  const info = getNetworkInfo({
    clientPort: queryPort > 0 ? queryPort : undefined,
    cloudUrl: detectedCloudUrl,
  });
  res.json(info);
}
