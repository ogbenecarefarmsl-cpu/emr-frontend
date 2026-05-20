export function normalizeApiBaseUrl(url?: string, fallback = 'http://localhost:3000') {
  return (url === undefined ? fallback : url).replace(/\/+$/, '');
}

export function getConfiguredApiBaseUrl() {
  return normalizeApiBaseUrl(import.meta.env.VITE_API_URL);
}

export function joinApiUrl(baseUrl: string, path: string) {
  const normalizedBase = normalizeApiBaseUrl(baseUrl);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}
