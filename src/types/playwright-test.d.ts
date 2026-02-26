declare module '@playwright/test' {
  export const test: unknown
  export const expect: unknown
  export const devices: Record<string, unknown>
  export function defineConfig(config: unknown): unknown
}
