/** API base URL without a trailing slash; empty string means "same origin" (dev proxy or Nginx). */
export const apiBaseUrl: string = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
