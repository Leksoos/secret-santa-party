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

export const STORAGE_KEY_NETWORK_OVERRIDE = 'santa_network_override';

function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    return null;
  } catch {
    return null;
  }
}

/**
 * Retrieves the persisted network override URL or IP from localStorage.
 */
export function getNetworkOverride(): string | null {
  try {
    const storage = getStorage();
    if (!storage) return null;
    return storage.getItem(STORAGE_KEY_NETWORK_OVERRIDE) || null;
  } catch {
    return null;
  }
}

/**
 * Persists a custom network override URL or IP into localStorage.
 */
export function setNetworkOverride(override: string): void {
  try {
    const storage = getStorage();
    if (!storage) return;
    const clean = override ? override.trim() : '';
    if (clean) {
      storage.setItem(STORAGE_KEY_NETWORK_OVERRIDE, clean);
    } else {
      clearNetworkOverride();
    }
  } catch (e) {
    console.error('Failed to save network override in localStorage:', e);
  }
}

/**
 * Clears the persisted network override from localStorage.
 */
export function clearNetworkOverride(): void {
  try {
    const storage = getStorage();
    if (!storage) return;
    storage.removeItem(STORAGE_KEY_NETWORK_OVERRIDE);
  } catch (e) {
    console.error('Failed to clear network override from localStorage:', e);
  }
}

// Aliases for compatibility
export const getInitialOverride = getNetworkOverride;
export const saveCustomNetworkOverride = setNetworkOverride;
export const clearCustomNetworkOverride = clearNetworkOverride;

/**
 * Fetches host network interface details and detected IP from the server.
 */
export async function fetchNetworkInfo(customClientPort?: number): Promise<NetworkInfoResponse | null> {
  try {
    const port =
      customClientPort ||
      (typeof window !== 'undefined' && window.location.port
        ? parseInt(window.location.port, 10)
        : 5173);
    const query = port ? `?port=${port}` : '';
    const res = await fetch(`/api/network-info${query}`);
    if (!res.ok) {
      console.warn(`[Network] /api/network-info returned HTTP ${res.status}`);
      return null;
    }
    const data: NetworkInfoResponse = await res.json();
    return data;
  } catch (err) {
    console.warn('[Network] Failed to fetch /api/network-info:', err);
    return null;
  }
}

/**
 * Computes the active base URL for QR codes and external joins:
 * 1. Explicit custom override (from parameter or localStorage) takes highest priority.
 * 2. Server-provided tunnel URL (e.g. ngrok / cloudflare) takes next priority.
 * 3. If accessing via localhost / 127.0.0.1, substitutes with the detected Wi-Fi LAN IP,
 *    preserving the client port (5173).
 * 4. Otherwise, returns current window.location.origin.
 */
export function computeBaseUrl(
  netInfo?: Partial<NetworkInfoResponse> | null,
  customOverride?: string | null
): string {
  // 1. Explicit user override takes top priority
  const effectiveOverride =
    customOverride !== undefined ? customOverride : getNetworkOverride();

  if (effectiveOverride && effectiveOverride.trim()) {
    let clean = effectiveOverride.trim();
    if (!/^https?:\/\//i.test(clean)) {
      clean = `http://${clean}`;
    }
    try {
      const parsed = new URL(clean);
      const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(parsed.hostname);
      if (isIp && !parsed.port) {
        const clientPort =
          typeof window !== 'undefined' && window.location.port
            ? window.location.port
            : netInfo?.port
            ? String(netInfo.port)
            : '5173';
        if (clientPort) {
          parsed.port = clientPort;
        }
      }
      return parsed.origin;
    } catch {
      return clean.replace(/\/+$/, '');
    }
  }

  // 2. Server-provided tunnel takes next priority
  if (netInfo?.tunnelUrl && netInfo.tunnelUrl.trim()) {
    return netInfo.tunnelUrl.trim().replace(/\/+$/, '');
  }

  // 3. If accessing via localhost / 127.0.0.1, adapt with detected LAN IP
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const isLoopback = currentHostname === 'localhost' || currentHostname === '127.0.0.1';

  if (isLoopback && netInfo?.ip && netInfo.ip !== '127.0.0.1') {
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
    const port =
      typeof window !== 'undefined' && window.location.port
        ? `:${window.location.port}`
        : netInfo.port
        ? `:${netInfo.port}`
        : ':5173';
    return `${protocol}//${netInfo.ip}${port}`;
  }

  // 4. Default: current window.location.origin
  return typeof window !== 'undefined' ? window.location.origin : (netInfo?.url || 'http://localhost:5173');
}
