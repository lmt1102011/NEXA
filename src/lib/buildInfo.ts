declare const __APP_VERSION__: string

/**
 * The version this bundle was built from. Injected by the `nexa-version` Vite
 * plugin at build time; falls back to a dev marker when running `vite dev`.
 */
export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
