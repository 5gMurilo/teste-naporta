/// <reference types="vite/client" />

// The only configuration that reaches the browser. Anything else with a VITE_ prefix would be
// compiled into the public bundle, so new entries here need a deliberate review.
interface ImportMetaEnv {
  /** Optional absolute base URL of the API; empty means same origin (proxy). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
