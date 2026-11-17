/**
 * Resolves the base URL for API and Socket.IO connections.
 * - In unified fullstack mode (Render / Railway / Fly / local), returns '' (relative requests).
 * - If running on GitHub Pages or external frontend, returns VITE_API_BASE_URL.
 */
export function getApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  return '';
}

/**
 * Prepends the API base URL to a relative API path if configured.
 */
export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${cleanPath}` : cleanPath;
}
